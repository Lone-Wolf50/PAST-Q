import { Router, Request, Response } from 'express';
import https from 'https';
import crypto from 'crypto';
import { supabase } from '../lib/supabase';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();

// PAYSTACK_SECRET is now accessed inside the route handlers to avoid dotenv loading issues

// ─── Fee calculation (GHS) ──────────────────────────────────────────────────
// Paystack charges 1.95% + GHS 0.50 (capped at GHS 2,000)
// We gross up so the client absorbs the fee
function addPaystackFee(amountGHS: number) {
  const percentageFee = 0.0195;
  const flatFee = 0.50;
  const cap = 2000;

  const grossed = (amountGHS + flatFee) / (1 - percentageFee);
  const fee = Math.min(grossed - amountGHS, cap);
  const total = amountGHS + fee;

  return {
    originalAmount: amountGHS,
    fee: parseFloat(fee.toFixed(2)),
    totalCharged: parseFloat(total.toFixed(2)),
    totalInKobo: Math.round(total * 100), // Paystack uses pesewas (×100)
  };
}

// --- INITIALIZE PAYMENT ---
// Creates a Paystack payment session and returns the checkout URL
router.post('/initialize', protect, async (req: AuthRequest, res: Response) => {
  const { plan } = req.body;
  const user = req.user!;

  const planPrices: Record<string, number> = {
    basic: 10,   // GH₵10.00
    plus:  25,   // GH₵25.00
    pro:   50,   // GH₵50.00
  };

  if (!plan || !planPrices[plan]) {
    res.status(400).json({ error: 'Invalid plan selected.' });
    return;
  }

  const { totalInKobo, fee, totalCharged } = addPaystackFee(planPrices[plan]);

  const params = JSON.stringify({
    email: user.email,
    amount: totalInKobo,
    currency: 'GHS',
    metadata: {
      user_id: user.id,
      plan,
      original_amount: planPrices[plan],
      paystack_fee: fee,
      total_charged: totalCharged,
      // Disable Paystack receipt emails/SMS so users receive no receipt
      send_email: false,
      send_sms: false,
    },
  });

  const options = {
    hostname: 'api.paystack.co',
    port: 443,
    path: '/transaction/initialize',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY!}`,
      'Content-Type': 'application/json',
    },
  };

  const paystackReq = https.request(options, (paystackRes) => {
    let data = '';
    paystackRes.on('data', (chunk) => (data += chunk));
    paystackRes.on('end', () => {
      const parsed = JSON.parse(data);
      if (!parsed.status) {
        console.error('Paystack Initialization Error:', parsed);
        res.status(500).json({ error: 'Failed to initialize payment.' });
        return;
      }
      res.status(200).json({
        authorization_url: parsed.data.authorization_url,
        access_code: parsed.data.access_code,
        reference: parsed.data.reference,
        email: user.email,
        totalInKobo,
        fee,
        totalCharged,
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
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY!}`,
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

      // Check if transaction already exists
      const { data: existingTx } = await supabase
        .from('upsa_transactions')
        .select('id')
        .eq('reference', reference)
        .single();

      if (!existingTx) {
        const planExpiresAt = new Date();
        if (plan.toLowerCase() === 'basic') {
          planExpiresAt.setDate(planExpiresAt.getDate() + 7);
        } else {
          planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
        }

        // Record transaction
        await supabase.from('upsa_transactions').insert({
          user_id,
          reference,
          plan,
          amount: parsed.data.amount / 100,
          status: 'success',
        });

        // Update user plan
        await supabase
          .from('upsa_users')
          .update({ plan, plan_expires: planExpiresAt.toISOString() })
          .eq('id', user_id);

        // Notify admin
        await supabase.from('upsa_admin_notifications').insert({
          title: 'New Subscription Payment',
          message: `User upgraded to ${plan} plan. Reference: ${reference}`,
          is_read: false
        });

        // Notify Student
        await supabase.from('upsa_notifications').insert({
          user_id,
          title: 'Subscription Upgraded',
          message: `Congratulations! Your account has been upgraded to the ${plan} plan.`,
          type: 'success'
        });
      }

      res.status(200).json({ message: `Plan upgraded to ${plan} successfully.` });
    });
  });

  paystackReq.on('error', () => {
    res.status(500).json({ error: 'Payment gateway error.' });
  });

  paystackReq.end();
});

// ─── WEBHOOK (Paystack calls this) ──────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  // Simple webhook handling. Note: For accurate signature matching, express.raw() is best,
  // but we gracefully handle if body is already JSON parsed.
  let hash = '';
  try {
    hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(JSON.stringify(req.body))
      .digest('hex');
  } catch (e) {
    // Ignore error
  }

  if (hash !== req.headers['x-paystack-signature']) {
    console.warn('Paystack webhook signature mismatch.');
  }

  const event = req.body;

  if (event?.event === 'charge.success') {
    const reference = event.data.reference;
    const { user_id, plan } = event.data.metadata || {};

    if (reference && user_id && plan) {
      const { data: existingTx } = await supabase
        .from('upsa_transactions')
        .select('id')
        .eq('reference', reference)
        .single();

      if (!existingTx) {
        const planExpiresAt = new Date();
        if (plan.toLowerCase() === 'basic') {
          planExpiresAt.setDate(planExpiresAt.getDate() + 7);
        } else {
          planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
        }

        await supabase.from('upsa_transactions').insert({
          user_id,
          reference,
          plan,
          amount: event.data.amount / 100,
          status: 'success',
        });

        await supabase
          .from('upsa_users')
          .update({ plan, plan_expires: planExpiresAt.toISOString() })
          .eq('id', user_id);

        await supabase.from('upsa_admin_notifications').insert({
          title: 'New Subscription Payment (Webhook)',
          message: `User upgraded to ${plan} plan. Reference: ${reference}`,
          is_read: false
        });

        // Notify Student
        await supabase.from('upsa_notifications').insert({
          user_id,
          title: 'Subscription Upgraded',
          message: `Congratulations! Your account has been upgraded to the ${plan} plan.`,
          type: 'success'
        });
      }
    }
  }

  res.sendStatus(200);
});

export default router;
