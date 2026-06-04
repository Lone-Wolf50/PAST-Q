import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: Number(process.env.EMAIL_PORT) === 465, // true only for 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Force IPv4 to avoid ENETUNREACH errors on environments with limited IPv6 support
  family: 4,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
} as any);

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
          <p style="color:#475569;font-size:12px;margin:0;">© 2024 PastQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"PastQ" <${process.env.EMAIL_USER}>`,
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

  await transporter.sendMail({
    from: `"PastQ" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};
