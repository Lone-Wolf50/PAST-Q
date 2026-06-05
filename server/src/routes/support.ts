import { Router } from 'express';
import { sendMailWithFallback } from '../lib/mailer';
import validator from 'validator';

const router = Router();

router.post('/contact', async (req, res) => {
  try {
    const { name, email, message, subject = 'Support Request' } = req.body;

    // 1. Validation
    if (!message || !email) {
      return res.status(400).json({ error: 'Email and message are required.' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    const text = `
Name: ${name || 'Not provided'}
Email: ${email}
Subject: ${subject}

Message:
${message}
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>New Support Request</h2>
        <p><strong>Name:</strong> ${name || 'Not provided'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p><strong>Message:</strong></p>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px solid #ddd; white-space: pre-wrap;">
          ${message}
        </div>
      </div>
    `;

    // 2. Send via fallback system
    await sendMailWithFallback({
      to: 'sayonaraa340@gmail.com', // Always send TO this address
      replyTo: email, // Student's email for easy reply
      subject: `[PastQ Support] ${subject}: ${name || 'Student'}`,
      text,
      html,
    });

    res.status(200).json({ message: 'Your message has been sent successfully!' });
  } catch (error: any) {
    res.status(500).json({ error: `Email Error: ${error.message || 'Check email settings'}` });
  }
});

export default router;
