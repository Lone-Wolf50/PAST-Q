import cron from 'node-cron';
import { supabase } from './supabase';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'PastQ <noreply@pastqhub.com>';



const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export async function runWeeklyDigestJob() {
  console.log('[Weekly Digest Cron] Starting weekly activity digest and inactive email job...');
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    // 1. Fetch verified student users
    const { data: students, error: userError } = await supabase
      .from('upsa_users')
      .select('id, email, username, full_name, total_points, streak_count, created_at')
      .eq('role', 'student')
      .eq('is_verified', true);

    if (userError) throw userError;
    if (!students || students.length === 0) {
      console.log('[Weekly Digest Cron] No verified students found. Exiting.');
      return;
    }

    // 2. Fetch submissions from the last 7 days
    const { data: recentSubs, error: subError } = await supabase
      .from('upsa_submissions')
      .select('user_id, points_awarded, question_id, submitted_at')
      .gte('submitted_at', sevenDaysAgoStr);

    if (subError) throw subError;

    // 3. Fetch sessions from the last 7 days
    const { data: recentSessions, error: sessionError } = await supabase
      .from('upsa_sessions')
      .select('id, user_id, started_at')
      .gte('started_at', sevenDaysAgoStr);

    if (sessionError) throw sessionError;

    // Map recent submissions by user_id
    const recentSubsMap = new Map<string, typeof recentSubs>();
    (recentSubs || []).forEach(sub => {
      if (!recentSubsMap.has(sub.user_id)) {
        recentSubsMap.set(sub.user_id, []);
      }
      recentSubsMap.get(sub.user_id)!.push(sub);
    });

    // Map recent sessions by user_id
    const recentSessionsMap = new Map<string, typeof recentSessions>();
    (recentSessions || []).forEach(sess => {
      if (!recentSessionsMap.has(sess.user_id)) {
        recentSessionsMap.set(sess.user_id, []);
      }
      recentSessionsMap.get(sess.user_id)!.push(sess);
    });

    // 4. Calculate Leaderboard Rankings (Now and 7 days ago)
    // Map recent points earned in last 7 days per user
    const recentPointsMap = new Map<string, number>();
    recentSubsMap.forEach((subs, uid) => {
      const pts = subs.reduce((sum, s) => sum + (Number(s.points_awarded) || 0), 0);
      recentPointsMap.set(uid, pts);
    });

    // Sort students NOW
    const sortedNow = [...students].sort((a, b) => {
      const pointsA = a.total_points || 0;
      const pointsB = b.total_points || 0;
      if (pointsB !== pointsA) return pointsB - pointsA;
      const streakA = a.streak_count || 0;
      const streakB = b.streak_count || 0;
      if (streakB !== streakA) return streakB - streakA;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Sort students THEN (7 days ago)
    const sortedThen = [...students].map(s => {
      const recentPts = recentPointsMap.get(s.id) || 0;
      const pointsThen = Math.max(0, (s.total_points || 0) - recentPts);
      return {
        ...s,
        points_then: pointsThen
      };
    }).sort((a, b) => {
      const pointsA = a.points_then;
      const pointsB = b.points_then;
      if (pointsB !== pointsA) return pointsB - pointsA;
      const streakA = a.streak_count || 0;
      const streakB = b.streak_count || 0;
      if (streakB !== streakA) return streakB - streakA;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const rankNowMap = new Map<string, number>();
    sortedNow.forEach((u, idx) => {
      rankNowMap.set(u.id, idx + 1);
    });

    const rankThenMap = new Map<string, number>();
    sortedThen.forEach((u, idx) => {
      rankThenMap.set(u.id, idx + 1);
    });

    // Process each student
    for (const student of students) {
      const userSubs = recentSubsMap.get(student.id) || [];
      const userSessions = recentSessionsMap.get(student.id) || [];

      const hasActivity = userSubs.length > 0 || userSessions.length > 0;

      if (hasActivity) {
        // --- WEEKLY ACTIVITY DIGEST EMAIL ---
        const quizzesCompleted = userSessions.length;
        const xpEarned = userSubs.reduce((sum, s) => sum + (Number(s.points_awarded) || 0), 0);
        const rankNow = rankNowMap.get(student.id) || sortedNow.length;
        const rankThen = rankThenMap.get(student.id) || sortedThen.length;
        const rankChange = rankThen - rankNow; // Positive is improvement

        // Find closest competitor on sortedNow
        const myIdx = sortedNow.findIndex(u => u.id === student.id);
        let competitorHtml = '';
        if (myIdx > 0) {
          const competitor = sortedNow[myIdx - 1];
          const diff = (competitor.total_points || 0) - (student.total_points || 0);
          competitorHtml = `
            <div style="background-color: #0f0c1b; border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
              <p style="font-size: 13px; color: #a5b4fc; font-weight: 700; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em;">🔥 Close Competitor</p>
              <p style="font-size: 14px; color: #ffffff; margin: 0;"><strong>${competitor.username || competitor.full_name || 'Another student'}</strong> is just <strong>${diff} XP</strong> ahead of you! Can you catch them this week?</p>
            </div>
          `;
        } else if (sortedNow.length > 1) {
          // If rank 1, closest competitor is rank 2 (index 1)
          const competitor = sortedNow[1];
          const diff = (student.total_points || 0) - (competitor.total_points || 0);
          competitorHtml = `
            <div style="background-color: #0f0c1b; border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
              <p style="font-size: 13px; color: #34d399; font-weight: 700; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em;">👑 Leaderboard King</p>
              <p style="font-size: 14px; color: #ffffff; margin: 0;">You are at the top! <strong>${competitor.username || competitor.full_name || 'Another student'}</strong> is trailing by <strong>${diff} XP</strong> behind you. Defend your crown!</p>
            </div>
          `;
        }

        const subject = `Weekly Activity Digest - PastQ 📊`;
        const html = `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="margin: 0; padding: 0; background-color: #0f0c1b; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #cbd5e1; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
            <div style="background-color: #0f0c1b; padding: 40px 20px; text-align: center;">
              <div style="max-width: 500px; margin: 0 auto; background-color: #1c1a2e; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 35px 40px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; tracking-tight: -0.025em;">Past<span style="color: #a5b4fc;">Q</span></h1>
                  <p style="color: #c7d2fe; margin: 8px 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Your Weekly Study Digest</p>
                </div>
                <div style="padding: 35px 30px 40px 30px;">
                  <p style="font-size: 16px; color: #ffffff; font-weight: 700; margin: 0 0 10px 0;">Hello ${student.username || student.full_name || 'Student'},</p>
                  <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 30px 0;">Here is a summary of your academic achievements on PastQ for the past week. Keep up the amazing momentum!</p>
                  
                  <!-- Stats Grid -->
                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <tr>
                      <td style="width: 50%; padding: 15px; text-align: center; background-color: #0f0c1b; border: 1px solid rgba(255,255,255,0.05); border-top-left-radius: 12px; border-bottom-left-radius: 0;">
                        <div style="font-size: 24px; font-weight: 800; color: #6366f1;">${quizzesCompleted}</div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.05em;">Quizzes Started</div>
                      </td>
                      <td style="width: 50%; padding: 15px; text-align: center; background-color: #0f0c1b; border: 1px solid rgba(255,255,255,0.05); border-top-right-radius: 12px; border-bottom-right-radius: 0;">
                        <div style="font-size: 24px; font-weight: 800; color: #f59e0b;">+${xpEarned}</div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.05em;">XP Earned</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="width: 50%; padding: 15px; text-align: center; background-color: #0f0c1b; border: 1px solid rgba(255,255,255,0.05); border-bottom-left-radius: 12px; border-top-left-radius: 0;">
                        <div style="font-size: 24px; font-weight: 800; color: #ffffff;">#${rankNow}</div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.05em;">Leaderboard Rank</div>
                      </td>
                      <td style="width: 50%; padding: 15px; text-align: center; background-color: #0f0c1b; border: 1px solid rgba(255,255,255,0.05); border-bottom-right-radius: 12px; border-top-right-radius: 0;">
                        <div style="font-size: 24px; font-weight: 800; color: ${rankChange > 0 ? '#10b981' : rankChange < 0 ? '#ef4444' : '#cbd5e1'};">
                          ${rankChange > 0 ? `▲ ${rankChange}` : rankChange < 0 ? `▼ ${Math.abs(rankChange)}` : '—'}
                        </div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.05em;">Rank Change</div>
                      </td>
                    </tr>
                  </table>

                  <!-- Competitor block -->
                  ${competitorHtml}

                  <!-- CTA -->
                  <div style="text-align: center; margin-top: 35px;">
                    <a href="${FRONTEND_URL}/quiz" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); text-transform: uppercase; letter-spacing: 0.05em;">Enter Quiz Arena</a>
                  </div>
                </div>
                <div style="padding: 20px 30px; border-top: 1px solid rgba(255,255,255,0.05); background-color: #121023; text-align: center;">
                  <p style="color: #475569; font-size: 11px; margin: 0; line-height: 1.5;">You are receiving this weekly digest because you are an active student on PastQ.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        const { error: digestErr } = await resend.emails.send({
          from: FROM,
          to: student.email,
          subject,
          html
        });
        if (digestErr) console.error(`[Weekly Digest] Failed for ${student.email}:`, digestErr.message);
      } else {
        // --- INACTIVE STUDENT EMAIL (7+ Days Inactive) ---
        // Check if student signed up at least 7 days ago
        const dateCreated = new Date(student.created_at).getTime();
        const nowTime = Date.now();
        const isSevenDaysOld = (nowTime - dateCreated) >= 7 * 24 * 60 * 60 * 1000;

        if (isSevenDaysOld) {
          const subject = `We miss you at PastQ! 📚`;
          const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="margin: 0; padding: 0; background-color: #0f0c1b; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #cbd5e1; -webkit-font-smoothing: antialiased;">
              <div style="background-color: #0f0c1b; padding: 40px 20px; text-align: center;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #1c1a2e; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                  <div style="background: linear-gradient(135deg, #ec4899, #8b5cf6); padding: 35px 40px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; tracking-tight: -0.025em;">Past<span style="color: #fbcfe8;">Q</span></h1>
                    <p style="color: #fce7f3; margin: 8px 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">We miss you!</p>
                  </div>
                  <div style="padding: 35px 30px 40px 30px;">
                    <p style="font-size: 16px; color: #ffffff; font-weight: 700; margin: 0 0 10px 0;">Hello ${student.username || student.full_name || 'Student'},</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 30px 0;">It's been a while since your last quiz on PastQ. Consistent practice is the key to exam success! Don't let your streak expire and don't let others take your spot on the leaderboard.</p>
                    
                    <div style="background-color: #0f0c1b; border: 1px solid rgba(236, 72, 153, 0.2); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 30px;">
                      <p style="font-size: 14px; color: #fbcfe8; font-weight: 700; margin: 0 0 8px 0;">🔥 Ready to climb back up?</p>
                      <p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.5;">New papers and quiz questions have been added since you last logged in. Log in today to claim your daily streaks!</p>
                    </div>

                    <!-- CTA -->
                    <div style="text-align: center; margin-top: 30px;">
                      <a href="${FRONTEND_URL}/quiz" style="display: inline-block; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 15px rgba(236, 72, 153, 0.4); text-transform: uppercase; letter-spacing: 0.05em;">Resume Learning Now</a>
                    </div>
                  </div>
                  <div style="padding: 20px 30px; border-top: 1px solid rgba(255,255,255,0.05); background-color: #121023; text-align: center;">
                    <p style="color: #475569; font-size: 11px; margin: 0; line-height: 1.5;">You are receiving this reminder because you haven't taken a quiz in 7+ days.</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `;

          const { error: inactiveErr } = await resend.emails.send({
            from: FROM,
            to: student.email,
            subject,
            html
          });
          if (inactiveErr) console.error(`[Weekly Digest] Inactive email failed for ${student.email}:`, inactiveErr.message);
        }
      }
    }
    console.log('[Weekly Digest Cron] Completed Weekly Digest successfully.');
  } catch (err: any) {
    console.error('[Weekly Digest Cron] Critical Error running weekly digest job:', err);
  }
}

// Schedule the cron job to run every Monday at 8:00 AM
// Expression: 0 8 * * 1 (Minute 0, Hour 8, Day of month *, Month *, Day of week 1 for Monday)
cron.schedule('0 8 * * 1', () => {
  runWeeklyDigestJob();
});
