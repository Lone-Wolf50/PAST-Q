import { Bot, Context } from 'node-telegram-bot-api';
import { supabase } from './supabase';
import { sendGeneralEmail } from './mailer';
import { invalidateCachedSession, redis } from './redis';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from server dir or root dir
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function getBotToken(): string {
  return (process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

function getChatId(): string {
  return (process.env.TELEGRAM_CHAT_ID || '').trim();
}

function isEnabled(): boolean {
  return process.env.TELEGRAM_ENABLED === 'true' || process.env.TELEGRAM_ENABLED === undefined;
}

let bot: Bot | null = null;
let isPollingActive = false;

// ── In-Memory Pending Broadcast Drafts (for safe 2-step confirmation) ────────
interface PendingBroadcast {
  subject: string;
  title: string;
  body: string;
  recipientsCount: number;
  timestamp: number;
}
const pendingBroadcasts = new Map<string, PendingBroadcast>();

// ── Resilient Polling Loop ──────────────────────────────────────────────────
// Automatically recovers from 409 Conflict, network drops, or temporary Telegram API errors
async function startResilientPolling(botInstance: Bot) {
  if (isPollingActive) return;
  isPollingActive = true;

  console.log('[Telegram] 📡 Starting resilient Telegram bot polling loop...');

  while (isPollingActive) {
    try {
      await botInstance.startPolling();
      if (!isPollingActive) break;
    } catch (err: any) {
      if (!isPollingActive) break;
      const msg = err?.message || String(err);

      if (msg.includes('409') || msg.includes('Conflict')) {
        console.warn('[Telegram] ⚠️ 409 Conflict (another instance running or reloading). Retrying in 3s...');
        await new Promise((r) => setTimeout(r, 3000));
      } else if (msg.includes('abort')) {
        break;
      } else {
        console.warn(`[Telegram] ⚠️ Polling error (${msg}). Reconnecting in 3s...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  console.log('[Telegram] 🛑 Polling loop stopped.');
}

const BOT_COMMANDS = [
  { command: 'stats', description: 'Full dashboard KPI summary' },
  { command: 'digest', description: 'Trigger daily KPI digest now' },
  { command: 'revenue', description: 'Revenue breakdown by plan' },
  { command: 'users', description: 'Total students and recent signups' },
  { command: 'user', description: 'Student profile & limit status' },
  { command: 'plan', description: 'Set student plan (free/basic/plus/pro)' },
  { command: 'tempplan', description: 'Grant temporary plan for N days' },
  { command: 'revokeplan', description: 'Revert student to Free tier' },
  { command: 'suspend', description: 'Suspend student account access' },
  { command: 'activate', description: 'Restore suspended student account' },
  { command: 'aiuser', description: 'Toggle student AI tutor access' },
  { command: 'resetlimits', description: 'Reset AI query & PDF download quotas' },
  { command: 'email', description: 'Send direct email to student' },
  { command: 'broadcast', description: 'Compose mass email broadcast' },
  { command: 'broadcast_confirm', description: 'Confirm and send mass broadcast' },
  { command: 'broadcast_cancel', description: 'Discard pending broadcast draft' },
  { command: 'signups', description: 'View last 10 signups' },
  { command: 'deletions', description: 'View recent account deletions' },
  { command: 'failed', description: 'View failed join attempts' },
  { command: 'payments', description: 'View recent payments' },
  { command: 'ai', description: 'View or toggle global AI status' },
  { command: 'banner', description: 'View or update site banner' },
  { command: 'fallbacks', description: 'View or clear AI failover logs' },
  { command: 'cron', description: 'Retry failed cron emails or test digest' },
  { command: 'cache', description: 'Test or evict Redis session cache' },
  { command: 'papers', description: 'Total papers count' },
  { command: 'health', description: 'Server health and uptime check' },
  { command: 'help', description: 'Show all available commands' },
  { command: 'restore', description: 'Restore a deleted account (approve appeal)' },
  { command: 'approve', description: 'Approve a student exam submission' },
  { command: 'reject', description: 'Reject a student exam submission' },
  { command: 'pending', description: 'List pending exam submissions' },
];

// ── Initialize ──────────────────────────────────────────────────────────────
export function initTelegramBot() {
  const token = getBotToken();
  const enabled = isEnabled();

  if (!enabled || !token) {
    console.log('[Telegram] Bot disabled or token missing in .env. Skipping initialization.');
    return;
  }

  try {
    bot = new Bot(token);
    registerCommands(bot);

    // Auto-sync command list with Telegram Bot API so autocomplete menu updates
    bot.api.setMyCommands({ commands: BOT_COMMANDS }).catch((err: any) => {
      console.warn('[Telegram] Could not auto-sync commands with Telegram API:', err.message);
    });

    // Use polling in local dev / persistent server, no polling in Vercel serverless
    const usePolling = process.env.VERCEL !== '1';
    if (usePolling) {
      startResilientPolling(bot);
    }

    console.log(`[Telegram] ✅ Bot initialized successfully (polling=${usePolling}).`);

    const chatId = getChatId();
    if (!chatId) {
      console.warn('[Telegram] ⚠️  TELEGRAM_CHAT_ID is empty. Send any message or /start to @PastQAdminBot in Telegram to get your Chat ID.');
    } else {
      console.log(`[Telegram] 🔒 Authorized Admin Chat ID: ${chatId}`);
    }

    // Clean shutdown on process exit
    const cleanup = () => {
      isPollingActive = false;
      bot?.stop();
    };
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  } catch (err: any) {
    console.error('[Telegram] Failed to initialize bot:', err.message);
  }
}

// ── Send a message (fire-and-forget, never throws) ──────────────────────────
export async function notifyTelegram(message: string): Promise<void> {
  if (!bot && getBotToken() && isEnabled()) {
    initTelegramBot();
  }
  const chatId = getChatId();
  if (!bot || !chatId || !isEnabled()) {
    console.warn(`[Telegram] notifyTelegram skipped: bot=${Boolean(bot)}, chatId=${Boolean(chatId)}, enabled=${isEnabled()}`);
    return;
  }
  try {
    await bot.api.sendMessage({
      chat_id: Number(chatId) || chatId,
      text: message,
      parse_mode: 'Markdown',
    });
  } catch (err: any) {
    console.error('[Telegram] Failed to send message:', err.message);
  }
}

// ── Webhook update handler (for Vercel serverless / webhook mode) ───────────
export async function handleTelegramWebhook(update: any): Promise<void> {
  if (!isEnabled()) return;
  // Lazy-init the bot on cold starts (same pattern as notifyTelegram)
  if (!bot && getBotToken()) {
    initTelegramBot();
  }
  if (!bot) return;
  try {
    await bot.handleUpdate(update);
  } catch (err: any) {
    console.error('[Telegram Webhook] Failed to handle update:', err.message);
  }
}

// ── Escape markdown special characters for Telegram Markdown v1 ─────────────
export function esc(text: string | undefined | null): string {
  if (!text) return '';
  return text.replace(/[_*`\[]/g, '\\$&');
}

// ── Format currency ─────────────────────────────────────────────────────────
export function fmtMoney(amount: number): string {
  return `GH₵ ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Fetch stats (reuses same queries as /stats endpoint) ────────────────────
export async function fetchDashboardStats() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      studentsRes,
      activeSubsRes,
      papersRes,
      deletedRes,
      failedRes,
      allTransactionsRes,
      todaySignupsRes,
      todayDeletionsRes,
      todayTransactionsRes,
      aiStatsRes,
      configRes,
    ] = await Promise.all([
      supabase.from('upsa_users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_verified', true),
      supabase.from('upsa_users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_verified', true).neq('plan', 'free'),
      supabase.from('upsa_papers').select('*', { count: 'exact', head: true }),
      supabase.from('upsa_deleted_accounts').select('*', { count: 'exact', head: true }),
      supabase.from('upsa_users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_verified', false),
      supabase.from('upsa_transactions').select('amount, status, plan, created_at'),
      supabase.from('upsa_users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_verified', true).gte('created_at', todayStart),
      supabase.from('upsa_deleted_accounts').select('*', { count: 'exact', head: true }).gte('deleted_at', todayStart),
      supabase.from('upsa_transactions').select('amount, status, plan').gte('created_at', todayStart),
      supabase.from('upsa_ai_queries').select('user_id, upsa_users(plan)').gte('created_at', thirtyDaysAgo),
      supabase.from('upsa_app_config').select('global_ai_block, global_banner, global_banner_active').eq('id', 1).single(),
    ]);

    // Revenue calculations
    const allTransactions = allTransactionsRes.data || [];
    let totalRevenue = 0;
    const revenueByPlan: Record<string, number> = { basic: 0, plus: 0, pro: 0 };
    allTransactions.forEach((t: any) => {
      if (t.status === 'success') {
        totalRevenue += Number(t.amount) || 0;
        const p = t.plan?.toLowerCase();
        if (p && p in revenueByPlan) revenueByPlan[p] += Number(t.amount) || 0;
      }
    });

    // Today's revenue
    const todayTxs = todayTransactionsRes.data || [];
    let todayRevenue = 0;
    todayTxs.forEach((t: any) => {
      if (t.status === 'success') todayRevenue += Number(t.amount) || 0;
    });

    // AI usage by plan
    const aiUsageByPlan: Record<string, number> = { free: 0, basic: 0, plus: 0, pro: 0 };
    (aiStatsRes.data || []).forEach((q: any) => {
      const plan = q.upsa_users?.plan?.toLowerCase();
      if (plan && plan in aiUsageByPlan) aiUsageByPlan[plan]++;
    });
    const totalAiQueries = Object.values(aiUsageByPlan).reduce((a, b) => a + b, 0);

    // Config
    const aiOnline = configRes.data ? !configRes.data.global_ai_block : true;
    const bannerActive = configRes.data?.global_banner_active || false;
    const bannerText = configRes.data?.global_banner || '';

    return {
      totalStudents: studentsRes.count || 0,
      activeSubs: activeSubsRes.count || 0,
      totalPapers: papersRes.count || 0,
      totalDeleted: deletedRes.count || 0,
      totalFailed: failedRes.count || 0,
      totalRevenue,
      revenueByPlan,
      todaySignups: todaySignupsRes.count || 0,
      todayDeletions: todayDeletionsRes.count || 0,
      todayRevenue,
      totalAiQueries,
      aiUsageByPlan,
      aiOnline,
      bannerActive,
      bannerText,
    };
  } catch (err: any) {
    console.error('[Telegram] Failed to fetch stats:', err.message);
    return null;
  }
}

// ── Build the daily digest message ──────────────────────────────────────────
export function buildDigestMessage(stats: NonNullable<Awaited<ReturnType<typeof fetchDashboardStats>>>): string {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const aiStatus = stats.aiOnline ? '🟢 Online' : '🔴 Offline';
  const bannerStatus = stats.bannerActive ? 'Active' : 'Hidden';

  return [
    `📊 *PastQ Daily Summary*`,
    `━━━━━━━━━━━━━━━━━━`,
    `📅 ${today}`,
    ``,
    `👥 Total Students: *${stats.totalStudents.toLocaleString()}*`,
    `📈 Active Subs: *${stats.activeSubs.toLocaleString()}*`,
    `📄 Papers: *${stats.totalPapers.toLocaleString()}*`,
    `🗑️ Deleted: *${stats.totalDeleted.toLocaleString()}*`,
    `⚠️ Failed: *${stats.totalFailed.toLocaleString()}*`,
    ``,
    `💰 *Revenue*`,
    `├ Basic: ${fmtMoney(stats.revenueByPlan.basic)}`,
    `├ Plus: ${fmtMoney(stats.revenueByPlan.plus)}`,
    `└ Pro: ${fmtMoney(stats.revenueByPlan.pro)}`,
    `📊 Total: *${fmtMoney(stats.totalRevenue)}*`,
    ``,
    `🤖 *AI Queries (30d)*: ${stats.totalAiQueries.toLocaleString()}`,
    `├ Free: ${stats.aiUsageByPlan.free.toLocaleString()}`,
    `├ Basic: ${stats.aiUsageByPlan.basic.toLocaleString()}`,
    `├ Plus: ${stats.aiUsageByPlan.plus.toLocaleString()}`,
    `└ Pro: ${stats.aiUsageByPlan.pro.toLocaleString()}`,
    ``,
    `🆕 Signups Today: *${stats.todaySignups}*`,
    `🗑️ Deletions Today: *${stats.todayDeletions}*`,
    `💰 Revenue Today: *${fmtMoney(stats.todayRevenue)}*`,
    ``,
    `🤖 AI Status: ${aiStatus}`,
    `📢 Banner: ${bannerStatus}${stats.bannerActive && stats.bannerText ? ` — "${esc(stats.bannerText.slice(0, 60))}"` : ''}`,
  ].join('\n');
}

// ── Send daily digest ───────────────────────────────────────────────────────
export async function sendDailyDigest(): Promise<void> {
  if (!bot && getBotToken() && isEnabled()) {
    initTelegramBot();
  }
  const chatId = getChatId();
  if (!bot || !chatId || !isEnabled()) {
    console.warn(`[Telegram] Cannot send daily digest: bot=${Boolean(bot)}, chatId=${Boolean(chatId)}, enabled=${isEnabled()}`);
    return;
  }

  try {
    const stats = await fetchDashboardStats();
    if (!stats) {
      await notifyTelegram('⚠️ Failed to generate daily digest — stats fetch error.');
      return;
    }

    const message = buildDigestMessage(stats);
    await notifyTelegram(message);
    console.log('[Telegram] Daily digest sent successfully.');
  } catch (err: any) {
    console.error('[Telegram] Failed to send daily digest:', err.message);
  }
}

// ── Command Handlers ────────────────────────────────────────────────────────
function registerCommands(bot: Bot) {
  // Only respond to authorized chat
  const isAuthorized = (chatId: number | string | undefined): boolean => {
    if (!chatId) return false;
    const configuredChatId = getChatId();
    if (!configuredChatId) return true; // If no chat ID set, allow all (for initial setup)
    return chatId.toString().trim() === configuredChatId.toString().trim();
  };

  // Catch unhandled errors gracefully
  bot.catch((err: any) => {
    console.error('[Telegram] Handler error:', err?.message || err);
  });

  // /start — show chat ID (for initial setup)
  bot.command('start', async (ctx: Context) => {
    const chatId = ctx.chatId;
    if (!chatId) return;
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /start from ${name} (${chatId})`);
    const configured = getChatId();
    await ctx.reply([
      `🤖 *PastQ Admin Bot*`,
      ``,
      `Your permanent Chat ID is:`,
      `\`${chatId}\``,
      ``,
      `${configured ? '✅ You are authorized!' : '⚠️ Copy the Chat ID above and set TELEGRAM_CHAT_ID=' + chatId + ' in your .env file.'}`,
      ``,
      `Type /help to see available commands.`,
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  // /help — list commands
  bot.command('help', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /help from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      console.warn(`[Telegram] ⛔ Unauthorized command attempt from chat ${ctx.chatId}`);
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    await ctx.reply([
      `📋 *PastQ Admin Commands*`,
      `━━━━━━━━━━━━━━━━━━`,
      `📊 *Analytics & KPIs*`,
      `/stats — Full dashboard KPI summary`,
      `/revenue — Revenue breakdown by plan`,
      `/payments — Recent payment transactions`,
      `/papers — Total papers count`,
      `/health — Server health check`,
      ``,
      `👤 *Student & Plan Control*`,
      `/users — Total students + recent signups`,
      `/user <email> — Student profile & limit status`,
      `/plan <email> <plan> — Set plan (free/basic/plus/pro)`,
      `/tempplan <email> <plan> [days] — Grant temp plan`,
      `/revokeplan <email> — Revert student to Free tier`,
      `/suspend <email> — Suspend student account`,
      `/activate <email> — Restore student account`,
      `/restore <email> — Approve deleted account appeal`,
      `/aiuser <email> <on|off> — Toggle student AI tutor`,
      `/resetlimits <email> — Reset AI & PDF quotas`,
      ``,
      `📧 *Email & Announcements*`,
      `/email <email> | <subj> | <body> — Send direct email`,
      `/broadcast <subj> | <title> | <body> — Mass broadcast`,
      `/signups — Last 10 signups with details`,
      `/deletions — Recent account deletions`,
      `/failed — Failed join attempts`,
      ``,
      `⚙️ *System & DevOps*`,
      `/ai [on|off] — Global AI master toggle`,
      `/banner [set <text>|on|off] — Global site banner`,
      `/fallbacks [clear] — AI failover logs`,
      `/cron [retry|test] — Cron retry & weekly digest`,
      `/cache [user <id>|flush] — Redis session cache`,
      ``,
      `📸 *Exam Submissions*`,
      `/pending — List pending exam papers`,
      `/approve <id> — Approve & grant 24hrs premium`,
      `/reject <id> <reason> — Reject with reason`,
      ``,
      `/help — Show this command menu`,
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  // /stats — full KPI summary
  bot.command('stats', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /stats from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    try {
      const stats = await fetchDashboardStats();
      if (!stats) {
        await ctx.reply('⚠️ Failed to fetch stats.');
        return;
      }
      await ctx.reply(buildDigestMessage(stats), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /digest — trigger daily digest on demand
  bot.command('digest', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /digest from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    try {
      await ctx.reply('⏳ Compiling PastQ Daily Summary...');
      await sendDailyDigest();
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /cron — test or trigger cron tasks
  bot.command('cron', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /cron from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const arg = typeof ctx.match === 'string' ? ctx.match.trim().toLowerCase() : '';
    if (arg === 'test' || arg === 'digest') {
      await ctx.reply('⏳ Manually triggering Daily Summary Digest...');
      await sendDailyDigest();
      return;
    }
    await ctx.reply([
      `⚙️ *Cron Commands*`,
      `━━━━━━━━━━━━━━━━━━`,
      `• \`/cron test\` — Trigger daily digest immediately`,
      `• \`/stats\` or \`/digest\` — Fetch current KPI summary`,
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  // /revenue — revenue breakdown
  bot.command('revenue', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /revenue from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    try {
      const { data: txns } = await supabase.from('upsa_transactions').select('amount, status, plan, created_at');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let total = 0;
      let todayTotal = 0;
      const byPlan: Record<string, number> = { basic: 0, plus: 0, pro: 0 };

      (txns || []).forEach((t: any) => {
        if (t.status === 'success') {
          const amt = Number(t.amount) || 0;
          total += amt;
          const p = t.plan?.toLowerCase();
          if (p && p in byPlan) byPlan[p] += amt;
          if (new Date(t.created_at) >= todayStart) todayTotal += amt;
        }
      });

      await ctx.reply([
        `💰 *Revenue Breakdown*`,
        `━━━━━━━━━━━━━━━━━━`,
        `├ Basic: ${fmtMoney(byPlan.basic)}`,
        `├ Plus: ${fmtMoney(byPlan.plus)}`,
        `└ Pro: ${fmtMoney(byPlan.pro)}`,
        ``,
        `📊 All-Time Total: *${fmtMoney(total)}*`,
        `💵 Today: *${fmtMoney(todayTotal)}*`,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /users — total students + recent signups
  bot.command('users', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /users from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    try {
      const [countRes, recentRes] = await Promise.all([
        supabase.from('upsa_users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_verified', true),
        supabase.from('upsa_users').select('full_name, email, plan, created_at').eq('role', 'student').eq('is_verified', true).order('created_at', { ascending: false }).limit(5),
      ]);

      const lines = [`👥 *Total Students*: ${countRes.count || 0}`, ``, `*Recent Signups:*`];
      (recentRes.data || []).forEach((u: any) => {
        const date = new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        lines.push(`• ${esc(u.full_name || 'No Name')} — ${u.plan} — ${date}`);
      });

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /signups — last 10 signups
  bot.command('signups', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /signups from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    try {
      const { data } = await supabase.from('upsa_users')
        .select('full_name, email, plan, created_at')
        .eq('role', 'student').eq('is_verified', true)
        .order('created_at', { ascending: false }).limit(10);

      const lines = [`🆕 *Last 10 Signups*`, `━━━━━━━━━━━━━━━━━━`];
      (data || []).forEach((u: any, i: number) => {
        const date = new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        lines.push(`${i + 1}. ${esc(u.full_name || 'No Name')} (${esc(u.email)}) — ${u.plan} — ${date}`);
      });

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /deletions — recent deletions
  bot.command('deletions', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /deletions from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    try {
      const { data } = await supabase.from('upsa_deleted_accounts')
        .select('full_name, email, plan, deleted_at')
        .order('deleted_at', { ascending: false }).limit(10);

      if (!data || data.length === 0) {
        await ctx.reply('🗑️ No recent account deletions.');
        return;
      }

      const lines = [`🗑️ *Recent Deletions*`, `━━━━━━━━━━━━━━━━━━`];
      (data || []).forEach((d: any, i: number) => {
        const date = new Date(d.deleted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        lines.push(`${i + 1}. ${esc(d.full_name || 'No Name')} (${esc(d.email)}) — ${d.plan} — ${date}`);
      });

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /failed — failed join attempts
  bot.command('failed', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /failed from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    try {
      const { data } = await supabase.from('upsa_users')
        .select('full_name, email, created_at')
        .eq('role', 'student').eq('is_verified', false)
        .order('created_at', { ascending: false }).limit(10);

      if (!data || data.length === 0) {
        await ctx.reply('⚠️ No failed join attempts.');
        return;
      }

      const lines = [`⚠️ *Failed Join Attempts*`, `━━━━━━━━━━━━━━━━━━`];
      data.forEach((f: any, i: number) => {
        const date = new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        lines.push(`${i + 1}. ${esc(f.full_name || 'No Name')} (${esc(f.email)}) — Pending OTP — ${date}`);
      });

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /ai — AI status + query distribution OR /ai on / /ai off
  bot.command('ai', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /ai (${ctx.match || 'status'}) from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const action = typeof ctx.match === 'string' ? ctx.match.trim().toLowerCase() : '';

    // Admin action: toggle AI block
    if (action === 'on' || action === 'off') {
      try {
        const block = action === 'off';
        await supabase
          .from('upsa_app_config')
          .update({ global_ai_block: block, updated_at: new Date().toISOString() })
          .eq('id', 1);

        await ctx.reply(`🤖 Global AI has been turned *${block ? '🔴 OFF (Blocked)' : '🟢 ON (Active)'}*!`, { parse_mode: 'Markdown' });
      } catch (err: any) {
        await ctx.reply(`⚠️ Failed to toggle AI: ${err.message}`);
      }
      return;
    }

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [configRes, aiRes] = await Promise.all([
        supabase.from('upsa_app_config').select('global_ai_block').eq('id', 1).single(),
        supabase.from('upsa_ai_queries').select('user_id, upsa_users(plan)').gte('created_at', thirtyDaysAgo),
      ]);

      const aiOnline = configRes.data ? !configRes.data.global_ai_block : true;
      const usage: Record<string, number> = { free: 0, basic: 0, plus: 0, pro: 0 };
      (aiRes.data || []).forEach((q: any) => {
        const p = q.upsa_users?.plan?.toLowerCase();
        if (p && p in usage) usage[p]++;
      });
      const total = Object.values(usage).reduce((a, b) => a + b, 0);

      await ctx.reply([
        `🤖 *AI Status*`,
        `━━━━━━━━━━━━━━━━━━`,
        `Status: ${aiOnline ? '🟢 Online' : '🔴 Offline (Blocked)'}`,
        ``,
        `*Queries (Last 30 days):* ${total.toLocaleString()}`,
        `├ Free: ${usage.free.toLocaleString()}`,
        `├ Basic: ${usage.basic.toLocaleString()}`,
        `├ Plus: ${usage.plus.toLocaleString()}`,
        `└ Pro: ${usage.pro.toLocaleString()}`,
        ``,
        `_Tip: Use \`/ai on\` or \`/ai off\` to toggle._`,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /banner — view or update banner
  bot.command('banner', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /banner from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const arg = typeof ctx.match === 'string' ? ctx.match.trim() : '';

    if (!arg) {
      try {
        const { data } = await supabase.from('upsa_app_config').select('global_banner, global_banner_active').eq('id', 1).single();
        await ctx.reply([
          `📢 *Current Global Banner*`,
          `━━━━━━━━━━━━━━━━━━`,
          `Status: ${data?.global_banner_active ? '🟢 Active' : '⚪ Hidden'}`,
          `Text: "${esc(data?.global_banner || 'No message set')}"`,
          ``,
          `*Commands:*`,
          `• \`/banner on\` — Enable banner`,
          `• \`/banner off\` — Disable banner`,
          `• \`/banner set <message>\` — Set text & activate`,
        ].join('\n'), { parse_mode: 'Markdown' });
      } catch (err: any) {
        await ctx.reply(`⚠️ Error: ${err.message}`);
      }
      return;
    }

    const lower = arg.toLowerCase();
    if (lower === 'on') {
      try {
        await supabase.from('upsa_app_config').update({ global_banner_active: true, updated_at: new Date().toISOString() }).eq('id', 1);
        await ctx.reply(`📢 Global banner is now *🟢 Active*!`, { parse_mode: 'Markdown' });
      } catch (err: any) {
        await ctx.reply(`⚠️ Failed to activate banner: ${err.message}`);
      }
    } else if (lower === 'off') {
      try {
        await supabase.from('upsa_app_config').update({ global_banner_active: false, updated_at: new Date().toISOString() }).eq('id', 1);
        await ctx.reply(`📢 Global banner is now *⚪ Hidden*!`, { parse_mode: 'Markdown' });
      } catch (err: any) {
        await ctx.reply(`⚠️ Failed to deactivate banner: ${err.message}`);
      }
    } else if (lower.startsWith('set ')) {
      const bannerText = arg.slice(4).trim();
      if (!bannerText) {
        await ctx.reply('⚠️ Please provide banner text. Example: `/banner set Exam results are out!`', { parse_mode: 'Markdown' });
        return;
      }
      try {
        await supabase.from('upsa_app_config').update({
          global_banner: bannerText,
          global_banner_active: true,
          updated_at: new Date().toISOString(),
        }).eq('id', 1);
        await ctx.reply(`📢 Global banner updated and activated:\n"${esc(bannerText)}"`, { parse_mode: 'Markdown' });
      } catch (err: any) {
        await ctx.reply(`⚠️ Failed to update banner: ${err.message}`);
      }
    } else {
      await ctx.reply(`⚠️ Unrecognized banner command. Use \`/banner on\`, \`/banner off\`, or \`/banner set <message>\`.`, { parse_mode: 'Markdown' });
    }
  });

  // /payments — recent payments
  bot.command('payments', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /payments from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    try {
      const { data } = await supabase.from('upsa_transactions')
        .select('reference, plan, amount, status, created_at, upsa_users(full_name, email)')
        .order('created_at', { ascending: false }).limit(10);

      if (!data || data.length === 0) {
        await ctx.reply('💰 No recent transactions.');
        return;
      }

      const lines = [`💰 *Recent Payments*`, `━━━━━━━━━━━━━━━━━━`];
      data.forEach((t: any, i: number) => {
        const date = new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const user = (t as any).upsa_users;
        const name = user?.full_name || user?.email || 'Unknown';
        const icon = t.status === 'success' ? '✅' : '❌';
        lines.push(`${i + 1}. ${icon} ${esc(name)} — ${fmtMoney(t.amount)} — ${t.plan} — ${date}`);
      });

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /papers — total papers
  bot.command('papers', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /papers from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    try {
      const { count } = await supabase.from('upsa_papers').select('*', { count: 'exact', head: true });
      const { data: recent } = await supabase.from('upsa_papers')
        .select('title, year, upsa_subjects(name)')
        .order('created_at', { ascending: false }).limit(5);

      const lines = [`📄 *Papers*`, `━━━━━━━━━━━━━━━━━━`, `Total: *${count || 0}*`, ``, `*Recently Added:*`];
      (recent || []).forEach((p: any) => {
        const subject = (p as any).upsa_subjects?.name || 'Unknown';
        lines.push(`• ${esc(p.title)} (${esc(subject)}, ${p.year})`);
      });

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /health — server health
  bot.command('health', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /health from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const memUsage = process.memoryUsage();
    const memMB = (memUsage.rss / 1024 / 1024).toFixed(1);

    await ctx.reply([
      `🏥 *Server Health*`,
      `━━━━━━━━━━━━━━━━━━`,
      `Status: 🟢 Online`,
      `Uptime: ${hours}h ${minutes}m`,
      `Memory: ${memMB} MB`,
      `Node: ${process.version}`,
      `Environment: ${process.env.VERCEL === '1' ? 'Vercel (Serverless)' : 'Persistent Server'}`,
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  // ── Plan Assignment: /plan <email> <plan> ──────────────────────────────────
  bot.command('plan', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /plan from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const rawArg = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    const parts = rawArg.split(/\s+/);
    if (parts.length < 2) {
      await ctx.reply([
        `⚠️ *Usage:* \`/plan <student_email> <free|basic|plus|pro>\``,
        `*Example:* \`/plan student@upsa.edu.gh pro\``,
      ].join('\n'), { parse_mode: 'Markdown' });
      return;
    }
    const email = parts[0].toLowerCase();
    const plan = parts[1].toLowerCase();
    const validPlans = ['free', 'basic', 'plus', 'pro'];
    if (!validPlans.includes(plan)) {
      await ctx.reply(`⚠️ Invalid plan \`${esc(plan)}\`. Options: \`free\`, \`basic\`, \`plus\`, \`pro\`.`, { parse_mode: 'Markdown' });
      return;
    }
    try {
      const { data: user, error: fetchErr } = await supabase.from('upsa_users')
        .select('id, email, full_name, plan')
        .eq('email', email)
        .single();

      if (fetchErr || !user) {
        await ctx.reply(`❌ Student not found with email \`${esc(email)}\`.`, { parse_mode: 'Markdown' });
        return;
      }
      const prevPlan = user.plan || 'free';
      const { error: updateErr } = await supabase.from('upsa_users')
        .update({ plan, original_plan: plan, temp_plan_expires_at: null })
        .eq('id', user.id);

      if (updateErr) {
        await ctx.reply(`❌ Update failed: ${updateErr.message}`);
        return;
      }

      await invalidateCachedSession(user.id).catch(() => {});

      await ctx.reply([
        `✅ *Plan Updated Successfully*`,
        `━━━━━━━━━━━━━━━━━━`,
        `👤 Student: *${esc(user.full_name || 'No Name')}*`,
        `📧 Email: \`${esc(user.email)}\``,
        `🔄 Previous: \`${prevPlan.toUpperCase()}\``,
        `⭐ New Plan: *${plan.toUpperCase()}*`,
        `🧹 Session Cache: Evicted (Instant Live Update)`,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // ── Temporary Plan: /tempplan <email> <plan> [days] ────────────────────────
  bot.command('tempplan', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /tempplan from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const rawArg = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    const parts = rawArg.split(/\s+/);
    if (parts.length < 2) {
      await ctx.reply([
        `⚠️ *Usage:* \`/tempplan <student_email> <basic|plus|pro> [days]\``,
        `*Example:* \`/tempplan student@upsa.edu.gh pro 7\``,
        `_(Days defaults to 5 if omitted)_`,
      ].join('\n'), { parse_mode: 'Markdown' });
      return;
    }
    const email = parts[0].toLowerCase();
    const plan = parts[1].toLowerCase();
    const days = parts[2] ? parseInt(parts[2], 10) : 5;
    const validPlans = ['basic', 'plus', 'pro'];
    if (!validPlans.includes(plan)) {
      await ctx.reply(`⚠️ Invalid plan \`${esc(plan)}\`. Options: \`basic\`, \`plus\`, \`pro\`.`, { parse_mode: 'Markdown' });
      return;
    }
    if (isNaN(days) || days < 1 || days > 30) {
      await ctx.reply('⚠️ Days must be a number between 1 and 30.', { parse_mode: 'Markdown' });
      return;
    }
    try {
      const { data: user, error: fetchErr } = await supabase.from('upsa_users')
        .select('id, email, full_name, plan, original_plan')
        .eq('email', email)
        .single();

      if (fetchErr || !user) {
        await ctx.reply(`❌ Student not found with email \`${esc(email)}\`.`, { parse_mode: 'Markdown' });
        return;
      }

      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const originalPlan = user.original_plan || user.plan || 'free';

      const { error: updateErr } = await supabase.from('upsa_users')
        .update({
          plan,
          original_plan: originalPlan,
          temp_plan_expires_at: expiresAt
        })
        .eq('id', user.id);

      if (updateErr) {
        await ctx.reply(`❌ Update failed: ${updateErr.message}`);
        return;
      }

      await invalidateCachedSession(user.id).catch(() => {});

      const expiryDate = new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      await ctx.reply([
        `⏳ *Temporary Plan Granted*`,
        `━━━━━━━━━━━━━━━━━━`,
        `👤 Student: *${esc(user.full_name || 'No Name')}*`,
        `📧 Email: \`${esc(user.email)}\``,
        `⭐ Temp Plan: *${plan.toUpperCase()}*`,
        `📅 Duration: *${days} day(s)* (Expires: ${expiryDate})`,
        `🔄 Auto-Revert: \`${originalPlan.toUpperCase()}\``,
        `🧹 Session Cache: Evicted (Instant Live Update)`,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // ── Revoke Plan: /revokeplan <email> ───────────────────────────────────────
  bot.command('revokeplan', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /revokeplan from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const email = typeof ctx.match === 'string' ? ctx.match.trim().toLowerCase() : '';
    if (!email) {
      await ctx.reply('⚠️ Usage: `/revokeplan <student_email>`', { parse_mode: 'Markdown' });
      return;
    }
    try {
      const { data: user } = await supabase.from('upsa_users').select('id, email, full_name, plan').eq('email', email).single();
      if (!user) {
        await ctx.reply(`❌ Student not found with email \`${esc(email)}\`.`, { parse_mode: 'Markdown' });
        return;
      }
      await supabase.from('upsa_users').update({ plan: 'free', original_plan: null, temp_plan_expires_at: null }).eq('id', user.id);
      await invalidateCachedSession(user.id).catch(() => {});
      await ctx.reply(`✅ Reverted *${esc(user.full_name || email)}* to *FREE* tier.`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // ── User Lookup: /user <email> ─────────────────────────────────────────────
  bot.command('user', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /user from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const email = typeof ctx.match === 'string' ? ctx.match.trim().toLowerCase() : '';
    if (!email) {
      await ctx.reply('⚠️ Usage: `/user <student_email>`\nExample: `/user student@upsa.edu.gh`', { parse_mode: 'Markdown' });
      return;
    }
    try {
      const { data: user, error: userErr } = await supabase.from('upsa_users')
        .select('id, email, full_name, plan, original_plan, temp_plan_expires_at, role, status, is_verified, ai_enabled, pdf_downloads_count, pdf_downloads_blocked_until, created_at')
        .eq('email', email)
        .single();

      if (userErr || !user) {
        await ctx.reply(`❌ Student not found with email \`${esc(email)}\`.`, { parse_mode: 'Markdown' });
        return;
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: queryCount } = await supabase.from('upsa_ai_queries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo);

      const isBlocked = user.pdf_downloads_blocked_until && new Date(user.pdf_downloads_blocked_until) > new Date();
      const pdfBlockedInfo = isBlocked
        ? `🔴 Blocked until ${new Date(user.pdf_downloads_blocked_until).toLocaleDateString('en-GB')}`
        : '🟢 Quota OK';

      const planText = user.temp_plan_expires_at
        ? `${user.plan.toUpperCase()} (Temp until ${new Date(user.temp_plan_expires_at).toLocaleDateString('en-GB')})`
        : user.plan.toUpperCase();

      const statusText = user.status === 'active' ? '🟢 Active' : user.status === 'suspended' ? '🟡 Suspended' : '🔴 Deactivated';

      await ctx.reply([
        `👤 *Student Profile*`,
        `━━━━━━━━━━━━━━━━━━`,
        `Name: *${esc(user.full_name || 'No Name')}*`,
        `Email: \`${esc(user.email)}\``,
        `Verified: ${user.is_verified ? '✅ Yes' : '❌ No'}`,
        `Plan: *${planText}*`,
        `Status: ${statusText}`,
        `AI Tutor: ${user.ai_enabled ?? true ? '🟢 Enabled' : '🔴 Disabled'}`,
        `AI Queries (30d): *${queryCount || 0}*`,
        `PDF Downloads: *${user.pdf_downloads_count || 0}* (${pdfBlockedInfo})`,
        `Joined: ${new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        ``,
        `_Quick Actions:_`,
        `• Change plan: \`/plan ${user.email} <plan>\``,
        `• Reset quotas: \`/resetlimits ${user.email}\``,
        `• Moderation: \`/suspend ${user.email}\` or \`/activate ${user.email}\``,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // ── Suspend User: /suspend <email> ─────────────────────────────────────────
  bot.command('suspend', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /suspend from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const email = typeof ctx.match === 'string' ? ctx.match.trim().toLowerCase() : '';
    if (!email) {
      await ctx.reply('⚠️ Usage: `/suspend <student_email>`', { parse_mode: 'Markdown' });
      return;
    }
    try {
      const { data: user } = await supabase.from('upsa_users').select('id, email, full_name').eq('email', email).single();
      if (!user) {
        await ctx.reply(`❌ Student not found with email \`${esc(email)}\`.`, { parse_mode: 'Markdown' });
        return;
      }
      await supabase.from('upsa_users').update({ status: 'suspended' }).eq('id', user.id);
      await invalidateCachedSession(user.id).catch(() => {});
      await ctx.reply(`🚫 Account for *${esc(user.full_name || email)}* is now *SUSPENDED*. Access blocked.`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // ── Activate User: /activate <email> ───────────────────────────────────────
  bot.command('activate', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /activate from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const email = typeof ctx.match === 'string' ? ctx.match.trim().toLowerCase() : '';
    if (!email) {
      await ctx.reply('⚠️ Usage: `/activate <student_email>`', { parse_mode: 'Markdown' });
      return;
    }
    try {
      const { data: user } = await supabase.from('upsa_users').select('id, email, full_name').eq('email', email).single();
      if (!user) {
        await ctx.reply(`❌ Student not found with email \`${esc(email)}\`.`, { parse_mode: 'Markdown' });
        return;
      }
      await supabase.from('upsa_users').update({ status: 'active' }).eq('id', user.id);
      await invalidateCachedSession(user.id).catch(() => {});
      await ctx.reply(`🟢 Account for *${esc(user.full_name || email)}* is now *ACTIVE*. Access restored.`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // ── Restore Deleted Account: /restore <email> ─────────────────────────────
  bot.command('restore', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /restore from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const email = typeof ctx.match === 'string' ? ctx.match.trim().toLowerCase() : '';
    if (!email) {
      await ctx.reply('⚠️ Usage: `/restore <email>`\nThis removes the email from the deleted accounts list, allowing them to register again.', { parse_mode: 'Markdown' });
      return;
    }
    try {
      // Check if the email exists in deleted accounts
      const { data: deletedRecord } = await supabase
        .from('upsa_deleted_accounts')
        .select('id, email, full_name, plan, deleted_at')
        .eq('email', email)
        .maybeSingle();

      if (!deletedRecord) {
        await ctx.reply(`❌ No deleted account found for \`${esc(email)}\`.`, { parse_mode: 'Markdown' });
        return;
      }

      // Remove from deleted accounts — this allows re-registration
      const { error: deleteErr } = await supabase
        .from('upsa_deleted_accounts')
        .delete()
        .eq('id', deletedRecord.id);

      if (deleteErr) {
        await ctx.reply(`❌ Failed to restore: ${deleteErr.message}`);
        return;
      }

      // Notify via admin notification
      await supabase.from('upsa_admin_notifications').insert({
        title: '✅ Deleted Account Restored',
        message: `Admin approved account restoration for ${deletedRecord.full_name || 'Unknown'} (${email}). They can now register again.`,
        type: 'info',
      });

      // Send notification email to the user
      try {
        await sendGeneralEmail(
          email,
          'Your PastQ Account Restoration Has Been Approved',
          'Account Restoration Approved',
          `Hello ${deletedRecord.full_name?.split(/\s+/)[0] || 'there'},\n\nGreat news! Your account restoration request has been reviewed and approved. You can now register again on PastQ using this email address.\n\nVisit pastqhub.com and click "Register" to create your new account.\n\nWelcome back!`
        );
      } catch {
        // Non-critical — continue even if email fails
      }

      const deletedDate = new Date(deletedRecord.deleted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      await ctx.reply([
        `✅ *Account Restored Successfully*`,
        `━━━━━━━━━━━━━━━━━━`,
        `👤 Name: *${esc(deletedRecord.full_name || 'Unknown')}*`,
        `📧 Email: \`${esc(email)}\``,
        `📋 Previous Plan: ${deletedRecord.plan || 'free'}`,
        `🗑️ Was Deleted: ${deletedDate}`,
        ``,
        `The user has been emailed and can now register again.`,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // ── Toggle User AI: /aiuser <email> <on|off> ───────────────────────────────
  bot.command('aiuser', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /aiuser from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const rawArg = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    const parts = rawArg.split(/\s+/);
    if (parts.length < 2) {
      await ctx.reply('⚠️ Usage: `/aiuser <student_email> <on|off>`\nExample: `/aiuser student@upsa.edu.gh off`', { parse_mode: 'Markdown' });
      return;
    }
    const email = parts[0].toLowerCase();
    const toggle = parts[1].toLowerCase();
    if (toggle !== 'on' && toggle !== 'off') {
      await ctx.reply('⚠️ Use `on` or `off`. Example: `/aiuser student@upsa.edu.gh off`', { parse_mode: 'Markdown' });
      return;
    }
    const enabled = toggle === 'on';
    try {
      const { data: user } = await supabase.from('upsa_users').select('id, email, full_name').eq('email', email).single();
      if (!user) {
        await ctx.reply(`❌ Student not found with email \`${esc(email)}\`.`, { parse_mode: 'Markdown' });
        return;
      }
      await supabase.from('upsa_users').update({ ai_enabled: enabled }).eq('id', user.id);
      await invalidateCachedSession(user.id).catch(() => {});
      await ctx.reply(`🤖 AI tutor access for *${esc(user.full_name || email)}* is now *${enabled ? '🟢 ENABLED' : '🔴 DISABLED'}*.`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // ── Reset Limits: /resetlimits <email> ─────────────────────────────────────
  bot.command('resetlimits', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /resetlimits from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const email = typeof ctx.match === 'string' ? ctx.match.trim().toLowerCase() : '';
    if (!email) {
      await ctx.reply('⚠️ Usage: `/resetlimits <student_email>`', { parse_mode: 'Markdown' });
      return;
    }
    try {
      const { data: user } = await supabase.from('upsa_users').select('id, email, full_name').eq('email', email).single();
      if (!user) {
        await ctx.reply(`❌ Student not found with email \`${esc(email)}\`.`, { parse_mode: 'Markdown' });
        return;
      }
      // Reset PDF download limits and views
      await supabase.from('upsa_users').update({
        pdf_downloads_count: 0,
        pdf_downloads_blocked_until: null,
        pdf_views_count: 0,
        pdf_views_blocked_until: null,
      }).eq('id', user.id);

      // Clear recent 10h queries for free quota unblock
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
      await supabase.from('upsa_ai_queries').delete().eq('user_id', user.id).gte('created_at', tenHoursAgo);

      await invalidateCachedSession(user.id).catch(() => {});
      await ctx.reply(`⚡ All AI query quotas & PDF download limits have been *RESET* for *${esc(user.full_name || email)}*!`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // ── Direct Email: /email <email> | <subject> | <body> ───────────────────────
  bot.command('email', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /email from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const rawArg = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    const parts = rawArg.split('|').map(s => s.trim());
    if (parts.length < 3) {
      await ctx.reply([
        `⚠️ *Usage:* \`/email <email> | <subject> | <body>\``,
        `*Or:* \`/email <email> | <subject> | <title> | <body>\``,
        ``,
        `*Example:*`,
        `\`/email user@upsa.edu.gh | Notice | Update | Hello Jazz, your plan has been updated!\``,
      ].join('\n'), { parse_mode: 'Markdown' });
      return;
    }
    const email = parts[0].toLowerCase();
    const subject = parts[1];
    let title = subject;
    let body = '';
    if (parts.length === 3) {
      body = parts[2];
    } else {
      title = parts[2];
      body = parts.slice(3).join('|');
    }

    try {
      const { data: user } = await supabase.from('upsa_users').select('full_name').eq('email', email).maybeSingle();
      const studentName = user?.full_name?.trim() || 'PastQ Student';
      const firstName = user?.full_name?.trim().split(/\s+/)[0] || 'Student';

      const personalize = (txt: string) => txt
        .replace(/\{\{name\}\}/gi, studentName)
        .replace(/\{\{first_name\}\}/gi, firstName)
        .replace(/Hello PastQ Student/gi, `Hello ${firstName}`);

      await sendGeneralEmail(email, personalize(subject), personalize(title), personalize(body));
      await ctx.reply(`✅ Email delivered to \`${esc(email)}\`!`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`❌ Delivery failed to \`${esc(email)}\`: ${esc(err.message)}`, { parse_mode: 'Markdown' });
    }
  });

  // ── Email Broadcast: /broadcast <subject> | <title> | <body> ────────────────
  bot.command('broadcast', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /broadcast from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const rawArg = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    const parts = rawArg.split('|').map(s => s.trim());
    if (parts.length < 2) {
      await ctx.reply([
        `📢 *Mass Email Broadcast*`,
        `━━━━━━━━━━━━━━━━━━`,
        `*Usage:* \`/broadcast <subject> | <body>\``,
        `*Or:* \`/broadcast <subject> | <title> | <body>\``,
        ``,
        `*Example:*`,
        `\`/broadcast Exam Revision Papers | New 2026 Papers Live | Hello students, 2026 revision past papers are now live!\``,
        ``,
        `_A preview will be shown with recipient count before anything is sent._`,
      ].join('\n'), { parse_mode: 'Markdown' });
      return;
    }

    const subject = parts[0];
    let title = subject;
    let body = '';
    if (parts.length === 2) {
      body = parts[1];
    } else {
      title = parts[1];
      body = parts.slice(2).join('|');
    }

    try {
      const { count, error: countErr } = await supabase
        .from('upsa_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student')
        .eq('is_verified', true);

      if (countErr || !count) {
        await ctx.reply(`⚠️ No verified students found to broadcast to.`);
        return;
      }

      pendingBroadcasts.set(ctx.chatId!.toString(), {
        subject,
        title,
        body,
        recipientsCount: count,
        timestamp: Date.now(),
      });

      await ctx.reply([
        `📢 *Mass Broadcast Preview*`,
        `━━━━━━━━━━━━━━━━━━`,
        `👥 Audience: *${count} verified students*`,
        `📌 Subject: *${esc(subject)}*`,
        `🏷️ Title: *${esc(title)}*`,
        `📝 Message Body:`,
        `"${esc(body.slice(0, 200))}${body.length > 200 ? '...' : ''}"`,
        ``,
        `⚠️ *To SEND to all ${count} students, send:*`,
        `\`/broadcast_confirm\``,
        ``,
        `To discard this draft, send \`/broadcast_cancel\``,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // ── Broadcast Confirm: /broadcast_confirm ──────────────────────────────────
  bot.command('broadcast_confirm', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /broadcast_confirm from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const chatId = ctx.chatId?.toString();
    if (!chatId || !pendingBroadcasts.has(chatId)) {
      await ctx.reply('⚠️ No pending broadcast found. Compose one first with `/broadcast <subject> | <title> | <body>`.', { parse_mode: 'Markdown' });
      return;
    }
    const draft = pendingBroadcasts.get(chatId)!;
    pendingBroadcasts.delete(chatId);

    await ctx.reply(`📤 Starting broadcast to *${draft.recipientsCount}* students in batches of 10... Please wait.`, { parse_mode: 'Markdown' });

    try {
      const { data: students } = await supabase
        .from('upsa_users')
        .select('email, full_name')
        .eq('role', 'student')
        .eq('is_verified', true);

      if (!students || students.length === 0) {
        await ctx.reply('⚠️ No students found.');
        return;
      }

      let sent = 0;
      let failed = 0;
      const BATCH_SIZE = 10;

      for (let i = 0; i < students.length; i += BATCH_SIZE) {
        const batch = students.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(s => {
            const studentName = s.full_name?.trim() || 'PastQ Student';
            const firstName = s.full_name?.trim().split(/\s+/)[0] || 'Student';
            const personalize = (txt: string) => txt
              .replace(/\{\{name\}\}/gi, studentName)
              .replace(/\{\{first_name\}\}/gi, firstName)
              .replace(/Hello PastQ Student/gi, `Hello ${firstName}`);

            return sendGeneralEmail(
              s.email,
              personalize(draft.subject),
              personalize(draft.title),
              personalize(draft.body)
            );
          })
        );

        results.forEach(r => {
          if (r.status === 'fulfilled') sent++;
          else failed++;
        });

        if (i + BATCH_SIZE < students.length) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      await ctx.reply([
        `🎉 *Broadcast Dispatch Complete!*`,
        `━━━━━━━━━━━━━━━━━━`,
        `👥 Total: *${students.length}*`,
        `✅ Sent: *${sent}*`,
        `❌ Failed: *${failed}*`,
        `📌 Subject: *${esc(draft.subject)}*`,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Broadcast failed: ${err.message}`);
    }
  });

  // ── Broadcast Cancel: /broadcast_cancel ────────────────────────────────────
  bot.command('broadcast_cancel', async (ctx: Context) => {
    if (!isAuthorized(ctx.chatId)) return;
    const chatId = ctx.chatId?.toString();
    if (chatId && pendingBroadcasts.has(chatId)) {
      pendingBroadcasts.delete(chatId);
      await ctx.reply('🗑️ Broadcast draft discarded.', { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('ℹ️ No pending broadcast to discard.');
    }
  });

  // ── Redis Cache: /cache [user <userId>|flush] ──────────────────────────────
  bot.command('cache', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /cache from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const rawArg = typeof ctx.match === 'string' ? ctx.match.trim().toLowerCase() : '';
    if (!redis) {
      await ctx.reply('ℹ️ Upstash Redis is not configured (running in local-memory fallback mode).');
      return;
    }
    if (rawArg.startsWith('user ')) {
      const userId = rawArg.replace('user ', '').trim();
      await invalidateCachedSession(userId);
      await ctx.reply(`🧹 Evicted Redis session for user ID: \`${esc(userId)}\``, { parse_mode: 'Markdown' });
    } else {
      try {
        const ping = await redis.ping();
        await ctx.reply(`🟢 Upstash Redis is online. Ping: \`${ping}\`.\n_To evict a student session: \`/cache user <userId>\`_`, { parse_mode: 'Markdown' });
      } catch (err: any) {
        await ctx.reply(`⚠️ Redis ping failed: ${err.message}`);
      }
    }
  });

  // ── Cron Failures & Digest: /cron [retry|test] ─────────────────────────────
  bot.command('cron', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /cron from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const subcmd = typeof ctx.match === 'string' ? ctx.match.trim().toLowerCase() : '';
    if (subcmd === 'retry') {
      try {
        const { data: failures, error: fetchErr } = await supabase.from('cron_failures').select('*');
        if (fetchErr) throw fetchErr;
        if (!failures || failures.length === 0) {
          await ctx.reply('✨ No failed cron emails to retry. All schedules clear!');
          return;
        }
        let sent = 0;
        let failed = 0;
        for (const f of failures) {
          try {
            const subject = f.user_type === 'active' ? 'Biweekly Activity Digest - PastQ 📊' : 'We miss you at PastQ! 📚';
            const title = f.user_type === 'active' ? 'Your Biweekly Study Digest' : 'Come back to PastQ';
            const body = f.user_type === 'active'
              ? 'We tried to send you your biweekly study digest. Log in to PastQ to see your latest stats!'
              : 'It has been a while since your last visit. Log in today to claim daily streaks!';
            await sendGeneralEmail(f.email, subject, title, body);
            sent++;
            await supabase.from('cron_failures').delete().eq('id', f.id);
          } catch {
            failed++;
          }
        }
        await ctx.reply(`🔄 *Cron Retry Complete*\n• Sent: *${sent}*\n• Failed: *${failed}*`, { parse_mode: 'Markdown' });
      } catch (err: any) {
        await ctx.reply(`⚠️ Error: ${err.message}`);
      }
    } else if (subcmd === 'test' || subcmd === 'digest') {
      await ctx.reply('📡 Triggering weekly digest job in background...');
      try {
        const { runWeeklyDigestJob } = require('./cron');
        await runWeeklyDigestJob();
        await ctx.reply('✅ Weekly digest run completed.');
      } catch (err: any) {
        await ctx.reply(`⚠️ Failed to run weekly digest: ${err.message}`);
      }
    } else {
      await ctx.reply('⚠️ Usage: `/cron retry` (retry failed cron emails) or `/cron test` (trigger digest)', { parse_mode: 'Markdown' });
    }
  });

  // ── Model Fallbacks: /fallbacks [clear] ─────────────────────────────────────
  bot.command('fallbacks', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /fallbacks from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized. This bot is private to PastQ administrators.');
      return;
    }
    const subcmd = typeof ctx.match === 'string' ? ctx.match.trim().toLowerCase() : '';
    if (subcmd === 'clear') {
      try {
        const { data: allFallbacks } = await supabase.from('upsa_admin_notifications').select('id, metadata');
        const fallbackIds = (allFallbacks || []).filter((n: any) => !!n.metadata?.is_fallback).map((n: any) => n.id);
        if (fallbackIds.length > 0) {
          await supabase.from('upsa_admin_notifications').delete().in('id', fallbackIds);
        }
        await ctx.reply(`🧹 Cleared *${fallbackIds.length}* model fallback log(s).`, { parse_mode: 'Markdown' });
      } catch (err: any) {
        await ctx.reply(`⚠️ Failed to clear fallbacks: ${err.message}`);
      }
      return;
    }

    try {
      const { data } = await supabase.from('upsa_admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      const fallbacks = (data || []).filter((n: any) => !!n.metadata?.is_fallback);
      if (fallbacks.length === 0) {
        await ctx.reply('🟢 *No recent model fallbacks.* All AI and OCR services operating normally.', { parse_mode: 'Markdown' });
        return;
      }

      const lines = [`🔀 *Recent Model Fallbacks (${fallbacks.length})*`, `━━━━━━━━━━━━━━━━━━`];
      fallbacks.slice(0, 5).forEach((f: any, i: number) => {
        const attempts = f.metadata?.attempts || [];
        const primary = attempts[0]?.model_or_service || 'Unknown';
        const outcome = f.metadata?.success ? '🟢 Resolved' : '🔴 Failed';
        const type = f.metadata?.request_type || 'AI';
        lines.push(`${i + 1}. [${type}] ${esc(primary)} → ${outcome}`);
        lines.push(`   _${esc(f.title.slice(0, 50))}_`);
      });
      lines.push(``);
      lines.push(`_Tip: Type \`/fallbacks clear\` to clear resolved logs._`);
      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // EXAM SUBMISSION REVIEW COMMANDS
  // ══════════════════════════════════════════════════════════════════════════════

  // /approve <short_id> — Approve a student exam submission
  bot.command('approve', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /approve from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized.');
      return;
    }

    const shortId = (typeof ctx.match === 'string' ? ctx.match.trim() : '').split(' ')[0];
    if (!shortId) {
      await ctx.reply('⚠️ *Usage:* `/approve <submission_id>`\n*Example:* `/approve a1b2c3d4`', { parse_mode: 'Markdown' });
      return;
    }

    try {
      // Fetch the submission
      const { data: sub, error: subErr } = await supabase
        .from('upsa_exam_submissions')
        .select('*')
        .eq('short_id', shortId)
        .single();

      if (subErr || !sub) {
        await ctx.reply(`❌ Submission \`${esc(shortId)}\` not found.`, { parse_mode: 'Markdown' });
        return;
      }

      if (sub.status === 'approved') {
        await ctx.reply(`ℹ️ Submission \`${esc(shortId)}\` is already approved.`, { parse_mode: 'Markdown' });
        return;
      }

      if (sub.status === 'rejected') {
        await ctx.reply(`ℹ️ Submission \`${esc(shortId)}\` was previously rejected. To re-approve it, first reverse manually in the DB.`, { parse_mode: 'Markdown' });
        return;
      }

      // Fetch student
      const { data: student, error: studentErr } = await supabase
        .from('upsa_users')
        .select('id, email, full_name, plan, original_plan, temp_plan_expires_at')
        .eq('id', sub.user_id)
        .single();

      if (studentErr || !student) {
        await ctx.reply(`❌ Student user not found for this submission.`);
        return;
      }

      // ── Grant 24hrs premium via temp-plan system ───────────────────────
      const PREMIUM_HOURS = 24;
      const premiumPlan = 'basic';
      let newExpiry: Date;

      if (student.temp_plan_expires_at && new Date(student.temp_plan_expires_at) > new Date()) {
        // Stack on existing temp plan
        newExpiry = new Date(new Date(student.temp_plan_expires_at).getTime() + PREMIUM_HOURS * 60 * 60 * 1000);
      } else {
        newExpiry = new Date(Date.now() + PREMIUM_HOURS * 60 * 60 * 1000);
      }

      const originalPlan = student.original_plan || student.plan || 'free';

      await supabase.from('upsa_users')
        .update({
          plan: premiumPlan,
          original_plan: originalPlan,
          temp_plan_expires_at: newExpiry.toISOString(),
        })
        .eq('id', student.id);

      // Increment approved_submissions_count
      try {
        const rpcResult = await supabase.rpc('increment_column', {
          table_name: 'upsa_users',
          column_name: 'approved_submissions_count',
          row_id: student.id,
        });
        if (rpcResult.error) throw rpcResult.error;
      } catch {
        // Fallback: manual update if RPC doesn't exist
        const { data: currentUser } = await supabase
          .from('upsa_users')
          .select('approved_submissions_count')
          .eq('id', student.id)
          .single();
        const currentCount = currentUser?.approved_submissions_count || 0;
        await supabase.from('upsa_users')
          .update({ approved_submissions_count: currentCount + 1 })
          .eq('id', student.id);
      }

      // Update submission record
      await supabase.from('upsa_exam_submissions')
        .update({
          status: 'approved',
          premium_hours: PREMIUM_HOURS,
          premium_plan: premiumPlan,
          reviewed_at: new Date().toISOString(),
        })
        .eq('short_id', shortId);

      // Invalidate session cache so student sees the new plan immediately
      await invalidateCachedSession(student.id).catch(() => {});

      // Send approval email
      const expiryStr = newExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      try {
        await sendGeneralEmail(
          student.email,
          '🎉 Your exam paper was approved!',
          'Exam Paper Approved',
          `Great news! Your exam paper submission has been verified and approved.\n\n` +
          `📄 Subject: ${sub.subject_name || 'N/A'}\n` +
          `📅 Year: ${sub.year || 'N/A'} | Semester: ${sub.semester || 'N/A'}\n\n` +
          `🎁 Reward: You've earned ${PREMIUM_HOURS} hours of ${premiumPlan.toUpperCase()} plan access!\n` +
          `⏰ Premium active until: ${expiryStr}\n\n` +
          `Keep contributing exam papers to earn more premium time. Thank you for helping the PastQ community! 🙏`
        );
      } catch (emailErr: any) {
        console.warn('[Telegram] Approval email failed:', emailErr.message);
      }

      // Also create a student notification
      try {
        await supabase.from('upsa_notifications').insert({
          user_id: student.id,
          title: 'Exam paper approved! 🎉',
          message: `Your exam paper "${sub.subject_name || 'Submission'}" was approved! You earned ${PREMIUM_HOURS} hours of premium access.`,
          type: 'success',
        });
      } catch { /* non-fatal */ }

      await ctx.reply([
        `✅ *Approved!*`,
        `━━━━━━━━━━━━━━━━━━`,
        `• Student: ${esc(student.full_name || student.email)}`,
        `• Subject: ${esc(sub.subject_name || 'Unknown')}`,
        `• Reward: ${PREMIUM_HOURS}hrs ${premiumPlan.toUpperCase()}`,
        `• Premium until: ${expiryStr}`,
        `• Email notification sent ✉️`,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      console.error('[Telegram] /approve error:', err.message);
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /reject <short_id> <reason> — Reject a student exam submission
  bot.command('reject', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /reject from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized.');
      return;
    }

    const raw = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    const spaceIdx = raw.indexOf(' ');
    const shortId = spaceIdx > 0 ? raw.substring(0, spaceIdx) : raw;
    const reason = spaceIdx > 0 ? raw.substring(spaceIdx + 1).trim() : '';

    if (!shortId) {
      await ctx.reply('⚠️ *Usage:* `/reject <submission_id> <reason>`\n*Example:* `/reject a1b2c3d4 Image is too blurry`', { parse_mode: 'Markdown' });
      return;
    }

    try {
      const { data: sub, error: subErr } = await supabase
        .from('upsa_exam_submissions')
        .select('*')
        .eq('short_id', shortId)
        .single();

      if (subErr || !sub) {
        await ctx.reply(`❌ Submission \`${esc(shortId)}\` not found.`, { parse_mode: 'Markdown' });
        return;
      }

      if (sub.status !== 'pending') {
        await ctx.reply(`ℹ️ Submission \`${esc(shortId)}\` is already ${sub.status}.`, { parse_mode: 'Markdown' });
        return;
      }

      const adminNotes = reason || 'No reason provided.';

      // Update submission
      await supabase.from('upsa_exam_submissions')
        .update({
          status: 'rejected',
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
        })
        .eq('short_id', shortId);

      // Send rejection email
      const { data: student } = await supabase
        .from('upsa_users')
        .select('id, email, full_name')
        .eq('id', sub.user_id)
        .single();

      if (student) {
        try {
          await sendGeneralEmail(
            student.email,
            'Exam paper submission update',
            'Submission Not Approved',
            `Your exam paper submission was reviewed but not approved.\n\n` +
            `📄 Subject: ${sub.subject_name || 'N/A'}\n` +
            `❌ Reason: ${adminNotes}\n\n` +
            `Please try again with a clearer photo or a different exam paper. ` +
            `Make sure the text is readable and the paper is well-lit.`
          );
        } catch (emailErr: any) {
          console.warn('[Telegram] Rejection email failed:', emailErr.message);
        }

        // Student notification
        try {
          await supabase.from('upsa_notifications').insert({
            user_id: student.id,
            title: 'Exam paper not approved',
            message: `Your submission "${sub.subject_name || 'Submission'}" was not approved. Reason: ${adminNotes}`,
            type: 'warning',
          });
        } catch { /* non-fatal */ }
      }

      await ctx.reply([
        `❌ *Rejected*`,
        `━━━━━━━━━━━━━━━━━━`,
        `• Student: ${esc(student?.full_name || sub.user_email)}`,
        `• Subject: ${esc(sub.subject_name || 'Unknown')}`,
        `• Reason: ${esc(adminNotes)}`,
        `• Email notification sent ✉️`,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      console.error('[Telegram] /reject error:', err.message);
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // /pending — List all pending exam submissions
  bot.command('pending', async (ctx: Context) => {
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 📥 Command /pending from ${name} (${ctx.chatId})`);
    if (!isAuthorized(ctx.chatId)) {
      await ctx.reply('⛔ Unauthorized.');
      return;
    }

    try {
      const { data: pending, error } = await supabase
        .from('upsa_exam_submissions')
        .select('short_id, user_email, subject_name, course_code, year, semester, exam_type, submitted_at')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true })
        .limit(20);

      if (error) throw error;

      if (!pending || pending.length === 0) {
        await ctx.reply('✅ *No pending exam submissions!* All caught up. 🎉', { parse_mode: 'Markdown' });
        return;
      }

      const lines = [
        `📋 *Pending Exam Submissions (${pending.length})*`,
        `━━━━━━━━━━━━━━━━━━`,
      ];

      pending.forEach((s: any, i: number) => {
        const subjectLine = s.subject_name || s.course_code || 'Unknown';
        const dateLine = new Date(s.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        lines.push(`${i + 1}. \`${s.short_id}\` — ${esc(subjectLine)}`);
        lines.push(`   📧 ${esc(s.user_email)} • ${dateLine}`);
        if (s.year || s.semester) {
          lines.push(`   📅 ${s.year || '?'} | Sem ${s.semester || '?'} | ${s.exam_type || 'Exam'}`);
        }
      });

      lines.push('');
      lines.push('_Use `/approve <id>` or `/reject <id> reason` to review._');

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (err: any) {
      console.error('[Telegram] /pending error:', err.message);
      await ctx.reply(`⚠️ Error: ${err.message}`);
    }
  });

  // Listen to incoming non-command messages to help setup chat ID if not configured
  bot.on('message', async (ctx: Context) => {
    const text = ctx.message?.text;
    if (text?.startsWith('/')) return; // Ignore commands
    const chatId = ctx.chatId;
    if (!chatId) return;
    const name = ctx.from?.first_name || 'Admin';
    console.log(`[Telegram] 🔔 Message from ${name} (Chat ID: ${chatId}): "${text || '[non-text]'}"`);

    // If chat ID is not set yet in .env, reply with chat ID
    if (!getChatId()) {
      await ctx.reply([
        `🤖 *PastQ Admin Bot*`,
        ``,
        `Hello ${name}! Your permanent Chat ID is:`,
        `\`${chatId}\``,
        ``,
        `Add this to your server \`.env\` as:`,
        `\`TELEGRAM_CHAT_ID=${chatId}\``,
        ``,
        `Then restart your server and type /help to see all commands!`,
      ].join('\n'), { parse_mode: 'Markdown' });
    }
  });
}
