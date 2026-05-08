import { Router } from 'express';
import nodemailer from 'nodemailer';
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

    // 2. Transporter creation
    // We check for SMTP_USER/PASS first, then fall back to EMAIL_USER/PASS which exists in the .env
    const userEmail = process.env.SMTP_USER || process.env.EMAIL_USER || 'sayonaraa340@gmail.com';
    const userPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!userPass) {
      console.error('❌ [Support] Missing email password in .env (SMTP_PASS or EMAIL_PASS)');
      return res.status(500).json({ error: 'Email configuration error.' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: userEmail,
        pass: userPass, 
      },
    });

    // 3. Email Options
    const mailOptions = {
      from: userEmail,
      to: 'sayonaraa340@gmail.com', // Always send TO this address
      subject: `[PastQ Support] ${subject}: ${name || 'Student'}`,
      text: `
Name: ${name || 'Not provided'}
Email: ${email}
Subject: ${subject}

Message:
${message}
      `,
      replyTo: email // Student's email for easy reply
    };

    // 4. Send
    await transporter.sendMail(mailOptions);
    console.log(`✅ [Support] Email sent from ${email} via ${userEmail}`);

    res.status(200).json({ message: 'Your message has been sent successfully!' });
  } catch (error: any) {
    console.error('❌ [Support] Email Error:', error.message || error);
    res.status(500).json({ error: `Email Error: ${error.message || 'Check SMTP settings'}` });
  }
});

export default router;
