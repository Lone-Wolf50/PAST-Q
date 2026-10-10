import { Bot, Context } from 'node-telegram-bot-api';
import { supabase } from './supabase';
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
  const chatId = getChatId();
  if (!bot || !chatId || !isEnabled()) return;
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
export function handleTelegramWebhook(update: any): void {
  if (!bot || !isEnabled()) return;
  try {
    bot.handleUpdate(update).catch((err: any) => {
      console.error('[Telegram Webhook] Failed to handle update:', err.message);
    });
  } catch (err: any) {
    console.error('[Telegram Webhook] Failed to process update:', err.message);
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
  if (!bot || !getChatId() || !isEnabled()) return;

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
      `📋 *Available Commands*`,
      `━━━━━━━━━━━━━━━━━━`,
      `/stats — Full dashboard KPI summary`,
      `/revenue — Revenue breakdown by plan`,
      `/users — Total students + recent signups`,
      `/signups — Last 10 signups with details`,
      `/deletions — Recent account deletions`,
      `/failed — Failed join attempts`,
      `/ai — AI status + query distribution`,
      `/ai on — Enable global AI`,
      `/ai off — Disable global AI (block)`,
      `/banner — View current site banner`,
      `/banner set <text> — Set & activate banner`,
      `/banner on — Show banner`,
      `/banner off — Hide banner`,
      `/payments — Recent payment transactions`,
      `/papers — Total papers count`,
      `/health — Server health check`,
      `/help — Show this message`,
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
