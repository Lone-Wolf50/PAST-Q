import { Router } from 'express';
import { Resend } from 'resend';
import validator from 'validator';

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

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

    // 2. Send via Resend
    const { error } = await resend.emails.send({
      from: 'PastQ Support <noreply@pastqhub.com>',
      to: 'sayonaraa340@gmail.com', // Always send TO this address
      replyTo: email, // Student's email for easy reply
      subject: `[PastQ Support] ${subject}: ${name || 'Student'}`,
      text: `
Name: ${name || 'Not provided'}
Email: ${email}
Subject: ${subject}

Message:
${message}
      `,
    });

    if (error) {
      throw new Error(error.message);
    }

    res.status(200).json({ message: 'Your message has been sent successfully!' });
  } catch (error: any) {

    res.status(500).json({ error: `Email Error: ${error.message || 'Check email settings'}` });
  }
});

export default router;
