import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const FROM_BREVO = process.env.EMAIL_FROM || 'PastQ <noreply@pastqhub.com>';
const FROM_GMAIL = `PastQ <${process.env.EMAIL_USER || process.env.SMTP_USER || 'sayonaraa340@gmail.com'}>`;

/**
 * Helper to send email with Brevo SMTP as primary and Gmail SMTP as fallback.
 * If both fail, it throws an error.
 */
export const sendMailWithFallback = async (options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}) => {
  const brevoUser = process.env.BREVO_SMTP_USER?.trim();
  const brevoPass = process.env.BREVO_SMTP_PASS?.trim();

  let sentViaBrevo = false;
  let brevoError: any = null;

  if (brevoUser && brevoPass) {
    try {
      const brevoTransporter = nodemailer.createTransport({
        host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
        port: Number(process.env.BREVO_SMTP_PORT) || 587,
        secure: Number(process.env.BREVO_SMTP_PORT) === 465,
        auth: {
          user: brevoUser,
          pass: brevoPass,
        },
      });

      await brevoTransporter.sendMail({
        from: FROM_BREVO,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      });

      sentViaBrevo = true;
      console.log(`Email to ${options.to} sent successfully via Brevo SMTP.`);
    } catch (err: any) {
      brevoError = err;
      console.warn(`Failed to send email via Brevo SMTP to ${options.to}. Error: ${err.message || err}. Falling back to Gmail SMTP...`);
    }
  } else {
    console.warn(`Brevo SMTP credentials not fully configured. Skipping Brevo and falling back to Gmail SMTP...`);
  }

  if (!sentViaBrevo) {
    // Try Gmail fallback
    const gmailUser = process.env.EMAIL_USER || process.env.SMTP_USER || 'sayonaraa340@gmail.com';
    const gmailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

    if (!gmailPass) {
      const configError = new Error('Gmail SMTP password not configured for fallback.');
      console.error(configError.message);
      throw brevoError || configError;
    }

    const gmailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 465,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    try {
      await gmailTransporter.sendMail({
        from: FROM_GMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      });
      console.log(`Email to ${options.to} sent successfully via Gmail SMTP.`);
    } catch (gmailErr: any) {
      console.error(`Failed to send email via Gmail SMTP fallback to ${options.to}. Error: ${gmailErr.message || gmailErr}`);
      // Throw combined or final error
      throw new Error(`Email delivery failed. Brevo error: ${brevoError?.message || 'not configured'}. Gmail error: ${gmailErr.message || gmailErr}`);
    }
  }
};

/**
 * Send an OTP email for email verification or password reset.
 */
export const sendOtpEmail = async (to: string, otp: string, type: 'verify' | 'reset') => {
  const subject = type === 'verify' ? 'Verify your PastQ account' : 'Reset your PastQ password';
  const heading = type === 'verify' ? 'Email Verification' : 'Password Reset';
  const body = type === 'verify'
    ? 'Use the code below to verify your email address. It expires in 10 minutes.'
    : 'Use the code below to reset your password. It expires in 10 minutes.';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0f0c1b;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:480px;margin:40px auto;background:#1c1a2e;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
          <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">PastQ</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">${heading}</p>
        </div>
        <div style="padding:40px;">
          <p style="color:#cbd5e1;margin:0 0 24px;line-height:1.6;">${body}</p>
          <div style="background:#0f0c1b;border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#fff;">${otp}</span>
          </div>
          <p style="color:#64748b;font-size:13px;margin:0;">If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="color:#475569;font-size:12px;margin:0;">© ${new Date().getFullYear()} PastQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendMailWithFallback({
    to,
    subject,
    html,
  });
};

/**
 * Send a general-purpose email (announcements, broadcasts, etc.)
 */
export const sendGeneralEmail = async (to: string, subject: string, title: string, bodyText: string) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0f0c1b;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:480px;margin:40px auto;background:#1c1a2e;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
          <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">PastQ</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">${title}</p>
        </div>
        <div style="padding:40px;">
          <p style="color:#cbd5e1;margin:0;line-height:1.8;font-size:15px;white-space:pre-line;">${bodyText}</p>
        </div>
        <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="color:#475569;font-size:12px;margin:0;">© ${new Date().getFullYear()} PastQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendMailWithFallback({
    to,
    subject,
    html,
  });
};
