import { Router, Request, Response } from 'express';
import https from 'https';
import { supabase } from '../lib/supabase';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

// --- INITIALIZE PAYMENT ---
// Creates a Paystack payment session and returns the checkout URL
router.post('/initialize', protect, async (req: AuthRequest, res: Response) => {
  const { plan } = req.body;
  const user = req.user!;

  const planPrices: Record<string, number> = {
    basic: 1000,   // GH₵10.00 in pesewas
    plus:  2500,   // GH₵25.00
    pro:   5000,   // GH₵50.00
  };

  if (!plan || !planPrices[plan]) {
    res.status(400).json({ error: 'Invalid plan selected.' });
    return;
  }

  const params = JSON.stringify({
    email: user.email,
    amount: planPrices[plan],
    currency: 'GHS',
    metadata: {
      user_id: user.id,
      plan,
    },
    callback_url: `${process.env.FRONTEND_URL}/upgrade/success`,
  });

  const options = {
    hostname: 'api.paystack.co',
    port: 443,
    path: '/transaction/initialize',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
  };

  const paystackReq = https.request(options, (paystackRes) => {
    let data = '';
    paystackRes.on('data', (chunk) => (data += chunk));
    paystackRes.on('end', () => {
      const parsed = JSON.parse(data);
      if (!parsed.status) {
        res.status(500).json({ error: 'Failed to initialize payment.' });
        return;
      }
      res.status(200).json({
        authorization_url: parsed.data.authorization_url,
        reference: parsed.data.reference,
      });
    });
  });

  paystackReq.on('error', () => {
    res.status(500).json({ error: 'Payment gateway error.' });
  });

  paystackReq.write(params);
  paystackReq.end();
});

// --- VERIFY PAYMENT (Webhook or manual verify) ---
router.get('/verify/:reference', protect, async (req: AuthRequest, res: Response) => {
  const { reference } = req.params;

  const options = {
    hostname: 'api.paystack.co',
    port: 443,
    path: `/transaction/verify/${reference}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
    },
  };

  const paystackReq = https.request(options, (paystackRes) => {
    let data = '';
    paystackRes.on('data', (chunk) => (data += chunk));
    paystackRes.on('end', async () => {
      const parsed = JSON.parse(data);

      if (!parsed.status || parsed.data.status !== 'success') {
        res.status(400).json({ error: 'Payment verification failed.' });
        return;
      }

      const { user_id, plan } = parsed.data.metadata;
      const planExpiresAt = new Date();
      planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);

      // Record transaction
      await supabase.from('UPSA_transactions').insert({
        user_id,
        reference,
        plan,
        amount: parsed.data.amount / 100,
        status: 'success',
      });

      // Update user plan
      await supabase
        .from('UPSA_users')
        .update({ plan, plan_expires: planExpiresAt.toISOString() })
        .eq('id', user_id);

      res.status(200).json({ message: `Plan upgraded to ${plan} successfully.` });
    });
  });

  paystackReq.on('error', () => {
    res.status(500).json({ error: 'Payment gateway error.' });
  });

  paystackReq.end();
});

export default router;
