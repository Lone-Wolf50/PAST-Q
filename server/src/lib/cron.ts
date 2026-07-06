import cron from 'node-cron';
import { supabase } from './supabase';
import { sendMailWithFallback } from './mailer';
import { invalidateCachedSession } from './redis';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function runWeeklyDigestJob() {
  console.log('[Biweekly Digest Cron] Starting biweekly activity digest and inactive email job...');
  try {
    // ── Biweekly Gate ────────────────────────────────────────────────
    // The cron fires every Monday, but we only send emails every 2 weeks.
    // Check the global last_digest_run_at timestamp and skip if < 13 days ago.
    const THIRTEEN_DAYS_MS = 13 * 24 * 60 * 60 * 1000;

    const { data: appConfig } = await supabase
      .from('upsa_app_config')
      .select('last_digest_run_at')
      .eq('id', 1)
      .single();

    if (appConfig?.last_digest_run_at) {
      const lastRun = new Date(appConfig.last_digest_run_at).getTime();
      if (Date.now() - lastRun < THIRTEEN_DAYS_MS) {
        console.log('[Biweekly Digest Cron] Skipping — last run was less than 13 days ago.');
        return;
      }
    }

    const fourteenDaysAgo = new Date(Date.now() - FOURTEEN_DAYS_MS);
    const fourteenDaysAgoStr = fourteenDaysAgo.toISOString();

    const failedEmails: { email: string; type: string; error: string }[] = [];
    let successfulSends = 0;

    // 1. Fetch verified student users (added last_inactive_email_sent)
    const { data: students, error: userError } = await supabase
      .from('upsa_users')
      .select('id, email, username, full_name, total_points, streak_count, created_at, last_inactive_email_sent')
      .eq('role', 'student')
      .eq('is_verified', true);

    if (userError) throw userError;
    if (!students || students.length === 0) {
      console.log('[Biweekly Digest Cron] No verified students found. Exiting.');
      return;
    }

    // 2. Fetch submissions from the last 14 days
    const { data: recentSubs, error: subError } = await supabase
      .from('upsa_submissions')
      .select('user_id, points_awarded, question_id, submitted_at')
      .gte('submitted_at', fourteenDaysAgoStr);

    if (subError) throw subError;

    // 3. Fetch sessions from the last 14 days
    const { data: recentSessions, error: sessionError } = await supabase
      .from('upsa_sessions')
      .select('id, user_id, started_at')
      .gte('started_at', fourteenDaysAgoStr);

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

    // 4. Calculate Leaderboard Rankings (Now and 14 days ago)
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

    // Sort students THEN (14 days ago)
    const sortedThen = [...students].map(s => {
      const recentPts = recentPointsMap.get(s.id) || 0;
      const pointsThen = Math.max(0, (s.total_points || 0) - recentPts);
      return { ...s, points_then: pointsThen };
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
    sortedNow.forEach((u, idx) => rankNowMap.set(u.id, idx + 1));

    const rankThenMap = new Map<string, number>();
    sortedThen.forEach((u, idx) => rankThenMap.set(u.id, idx + 1));

    // Process each student
    for (const student of students) {
      const userSubs = recentSubsMap.get(student.id) || [];
      const userSessions = recentSessionsMap.get(student.id) || [];

      const hasActivity = userSubs.length > 0 || userSessions.length > 0;

      if (hasActivity) {
        // --- BIWEEKLY ACTIVITY DIGEST EMAIL ---
        const quizzesCompleted = userSessions.length;
        const xpEarned = userSubs.reduce((sum, s) => sum + (Number(s.points_awarded) || 0), 0);
        const rankNow = rankNowMap.get(student.id) || sortedNow.length;
        const rankThen = rankThenMap.get(student.id) || sortedThen.length;
        const rankChange = rankThen - rankNow;

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
          const competitor = sortedNow[1];
          const diff = (student.total_points || 0) - (competitor.total_points || 0);
          competitorHtml = `
            <div style="background-color: #0f0c1b; border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
              <p style="font-size: 13px; color: #34d399; font-weight: 700; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em;">👑 Leaderboard King</p>
              <p style="font-size: 14px; color: #ffffff; margin: 0;">You are at the top! <strong>${competitor.username || competitor.full_name || 'Another student'}</strong> is trailing by <strong>${diff} XP</strong> behind you. Defend your crown!</p>
            </div>
          `;
        }

        const subject = `Biweekly Activity Digest - PastQ 📊`;
        const html = `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="margin: 0; padding: 0; background-color: #0f0c1b; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #cbd5e1; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
            <div style="background-color: #0f0c1b; padding: 40px 20px; text-align: center;">
              <div style="max-width: 500px; margin: 0 auto; background-color: #1c1a2e; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 35px 40px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800;">Past<span style="color: #a5b4fc;">Q</span></h1>
                  <p style="color: #c7d2fe; margin: 8px 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Your Biweekly Study Digest</p>
                </div>
                <div style="padding: 35px 30px 40px 30px;">
                  <p style="font-size: 16px; color: #ffffff; font-weight: 700; margin: 0 0 10px 0;">Hello ${student.username || student.full_name || 'Student'},</p>
                  <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 30px 0;">Here is a summary of your academic achievements on PastQ for the past two weeks. Keep up the amazing momentum!</p>
                  
                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <tr>
                      <td style="width: 50%; padding: 15px; text-align: center; background-color: #0f0c1b; border: 1px solid rgba(255,255,255,0.05); border-top-left-radius: 12px;">
                        <div style="font-size: 24px; font-weight: 800; color: #6366f1;">${quizzesCompleted}</div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.05em;">Quizzes Started</div>
                      </td>
                      <td style="width: 50%; padding: 15px; text-align: center; background-color: #0f0c1b; border: 1px solid rgba(255,255,255,0.05); border-top-right-radius: 12px;">
                        <div style="font-size: 24px; font-weight: 800; color: #f59e0b;">+${xpEarned}</div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.05em;">XP Earned</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="width: 50%; padding: 15px; text-align: center; background-color: #0f0c1b; border: 1px solid rgba(255,255,255,0.05); border-bottom-left-radius: 12px;">
                        <div style="font-size: 24px; font-weight: 800; color: #ffffff;">#${rankNow}</div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.05em;">Leaderboard Rank</div>
                      </td>
                      <td style="width: 50%; padding: 15px; text-align: center; background-color: #0f0c1b; border: 1px solid rgba(255,255,255,0.05); border-bottom-right-radius: 12px;">
                        <div style="font-size: 24px; font-weight: 800; color: ${rankChange > 0 ? '#10b981' : rankChange < 0 ? '#ef4444' : '#cbd5e1'};">
                          ${rankChange > 0 ? `▲ ${rankChange}` : rankChange < 0 ? `▼ ${Math.abs(rankChange)}` : '—'}
                        </div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.05em;">Rank Change</div>
                      </td>
                    </tr>
                  </table>

                  ${competitorHtml}

                  <div style="text-align: center; margin-top: 35px;">
                    <a href="${FRONTEND_URL}/quiz" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); text-transform: uppercase; letter-spacing: 0.05em;">Enter Quiz Arena</a>
                  </div>
                </div>
                <div style="padding: 20px 30px; border-top: 1px solid rgba(255,255,255,0.05); background-color: #121023; text-align: center;">
                  <p style="color: #475569; font-size: 11px; margin: 0; line-height: 1.5;">You are receiving this biweekly digest because you are an active student on PastQ.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        try {
          await sendMailWithFallback({ to: student.email, subject, html });
          successfulSends++;
        } catch (digestErr: any) {
          const errMsg = digestErr.message || String(digestErr);
          console.error(`[Biweekly Digest] Failed for ${student.email}:`, errMsg);
          failedEmails.push({ email: student.email, type: 'Active Digest', error: errMsg });
        }

      } else {
        // --- INACTIVE STUDENT EMAIL ---

        const nowTime = Date.now();
        const dateCreated = new Date(student.created_at).getTime();

        // Only email students who signed up at least 14 days ago
        const isFourteenDaysOld = (nowTime - dateCreated) >= FOURTEEN_DAYS_MS;
        if (!isFourteenDaysOld) continue;

        // Skip if we already sent an inactive email within the last 12 days (prevents timing jitter issues)
        const TWELVE_DAYS_MS = 12 * 24 * 60 * 60 * 1000;
        if (student.last_inactive_email_sent) {
          const lastSent = new Date(student.last_inactive_email_sent).getTime();
          if ((nowTime - lastSent) < TWELVE_DAYS_MS) {
            console.log(`[Biweekly Digest] Skipping inactive email for ${student.email} — sent recently`);
            continue;
          }
        }

        // Check if this student has EVER had any session (not just last 14 days)
        const { count: everSessionCount } = await supabase
          .from('upsa_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', student.id);

        const neverUsed = !everSessionCount || everSessionCount === 0;

        // Pick copy based on whether they ever engaged
        const subject = neverUsed
          ? `You haven't tried the AI tutor yet 👀`
          : `We miss you at PastQ! 📚`;

        const headerSubtitle = neverUsed ? `You're missing out!` : `We miss you`;

        const bodyText = neverUsed
          ? `You signed up but haven't explored PastQ yet. Our AI tutor can explain any past paper question instantly — most students are surprised how useful it is. Try asking it one question today.`
          : `It's been a while since your last quiz on PastQ. Consistent practice is the key to exam success! Don't let others take your spot on the leaderboard.`;

        const highlightEmoji = neverUsed ? `🤖` : `🔥`;
        const highlightTitle = neverUsed ? `See what the AI tutor can do` : `Ready to climb back up?`;
        const highlightBody = neverUsed
          ? `Pick any past paper from your department and ask the AI to explain a question. It takes 30 seconds and could change how you study.`
          : `New papers and quiz questions have been added since you last logged in. Log in today to claim your daily streaks!`;

        const buttonText = neverUsed ? `Try the AI Tutor` : `Resume Learning Now`;
        const buttonLink = neverUsed ? `${FRONTEND_URL}/papers` : `${FRONTEND_URL}/quiz`;

        const html = `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="margin: 0; padding: 0; background-color: #0f0c1b; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #cbd5e1; -webkit-font-smoothing: antialiased;">
            <div style="background-color: #0f0c1b; padding: 40px 20px; text-align: center;">
              <div style="max-width: 500px; margin: 0 auto; background-color: #1c1a2e; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 35px 40px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800;">Past<span style="color: #a5b4fc;">Q</span></h1>
                  <p style="color: #c7d2fe; margin: 8px 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">${headerSubtitle}</p>
                </div>
                <div style="padding: 35px 30px 40px 30px;">
                  <p style="font-size: 16px; color: #ffffff; font-weight: 700; margin: 0 0 10px 0;">Hello ${student.username || student.full_name || 'Student'},</p>
                  <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 30px 0;">${bodyText}</p>
                  
                  <div style="background-color: #0f0c1b; border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 30px;">
                    <p style="font-size: 14px; color: #a5b4fc; font-weight: 700; margin: 0 0 8px 0;">${highlightEmoji} ${highlightTitle}</p>
                    <p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.5;">${highlightBody}</p>
                  </div>

                  <div style="text-align: center; margin-top: 30px;">
                    <a href="${buttonLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); text-transform: uppercase; letter-spacing: 0.05em;">${buttonText}</a>
                  </div>
                </div>
                <div style="padding: 20px 30px; border-top: 1px solid rgba(255,255,255,0.05); background-color: #121023; text-align: center;">
                  <p style="color: #475569; font-size: 11px; margin: 0; line-height: 1.5;">You are receiving this reminder because you haven't been active on PastQ recently.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        try {
          await sendMailWithFallback({ to: student.email, subject, html });
          successfulSends++;

          // Update last_inactive_email_sent so we don't spam them
          await supabase
            .from('upsa_users')
            .update({ last_inactive_email_sent: new Date().toISOString() })
            .eq('id', student.id);

        } catch (inactiveErr: any) {
          const errMsg = inactiveErr.message || String(inactiveErr);
          console.error(`[Biweekly Digest] Inactive email failed for ${student.email}:`, errMsg);
          failedEmails.push({ email: student.email, type: 'Inactive Reminder', error: errMsg });
        }
      }
    }

    // ── Mark this run so the next Monday is skipped (biweekly gate) ──
    await supabase
      .from('upsa_app_config')
      .update({ last_digest_run_at: new Date().toISOString() })
      .eq('id', 1);

    // ── Send Admin Notification summarizing results ───────────────────
    if (failedEmails.length > 0) {
      const errorDetails = failedEmails.map(f => `${f.email} (${f.type}): ${f.error}`).join('\n');
      await supabase.from('upsa_admin_notifications').insert({
        title: '⚠️ Email Digest Failures',
        message: `Biweekly digest sent to ${successfulSends} user(s). Failed to reach ${failedEmails.length} user(s):\n${errorDetails.slice(0, 1000)}`,
        type: 'alert'
      });
    } else {
      await supabase.from('upsa_admin_notifications').insert({
        title: '📧 Biweekly Digest Completed',
        message: `Biweekly email digest successfully sent to all ${successfulSends} active/inactive user(s) with zero failures.`,
        type: 'info'
      });
    }

    console.log('[Biweekly Digest Cron] Completed Biweekly Digest successfully.');
  } catch (err: any) {
    console.error('[Biweekly Digest Cron] Critical Error running biweekly digest job:', err);
  }
}



// ── Auto-Revert Expired Temporary Plans ──────────────────────────
export async function revertExpiredTempPlans() {
  console.log('[Temp Plan Cron] Checking for expired temporary plans...');
  try {
    const now = new Date().toISOString();
    
    const { data: expiredUsers, error } = await supabase
      .from('upsa_users')
      .select('id, email, full_name, plan, original_plan, temp_plan_expires_at')
      .not('temp_plan_expires_at', 'is', null)
      .lt('temp_plan_expires_at', now);
    
    if (error) throw error;
    
    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('[Temp Plan Cron] No expired temporary plans found.');
      return;
    }
    
    console.log(`[Temp Plan Cron] Found ${expiredUsers.length} expired temp plan(s). Reverting...`);
    
    const actualRevertedUsers = [];
    
    for (const user of expiredUsers) {
      const revertPlan = user.original_plan || 'free';
      
      const { data: updatedData, error: updateError } = await supabase
        .from('upsa_users')
        .update({
          plan: revertPlan,
          original_plan: null,
          temp_plan_expires_at: null
        })
        .eq('id', user.id)
        .not('temp_plan_expires_at', 'is', null)
        .select('id, email');
      
      if (updateError) {
        console.error(`[Temp Plan Cron] Failed to revert user ${user.email}:`, updateError);
        continue;
      }
      
      if (updatedData && updatedData.length > 0) {
        actualRevertedUsers.push(user);
        invalidateCachedSession(user.id).catch(() => {});
        console.log(`[Temp Plan Cron] Reverted ${user.email} from ${user.plan} back to ${revertPlan}`);
      } else {
        console.log(`[Temp Plan Cron] User ${user.email} was already reverted by another process.`);
      }
    }
    
    if (actualRevertedUsers.length > 0) {
      // Send a single admin notification summarizing all reversions
      await supabase.from('upsa_admin_notifications').insert({
        title: '⏳ Temporary Plans Expired',
        message: `${actualRevertedUsers.length} user(s) had their temporary plan reverted back to their original plan.`,
        type: 'info',
      });
    }
    
    console.log('[Temp Plan Cron] Completed reverting expired temporary plans.');
  } catch (err: any) {
    console.error('[Temp Plan Cron] Critical Error:', err);
  }
}

// Only register node-cron schedules when running outside Vercel (local dev / persistent server).
// On Vercel, cron jobs are triggered via Vercel Cron → /api/cron/* HTTP endpoints instead.
if (process.env.VERCEL !== '1') {
  // Run every Monday at 8:00 AM Ghana time (Africa/Accra = GMT+0)
  cron.schedule('0 8 * * 1', () => {
    runWeeklyDigestJob();
  }, {
    timezone: 'Africa/Accra'
  });

  // Run every hour to check for expired temporary plans
  cron.schedule('0 * * * *', () => {
    revertExpiredTempPlans();
  }, {
    timezone: 'Africa/Accra'
  });

  console.log('[Cron] node-cron schedules registered (non-Vercel environment).');
} else {
  console.log('[Cron] Running on Vercel — node-cron schedules skipped. Using Vercel Cron instead.');
}