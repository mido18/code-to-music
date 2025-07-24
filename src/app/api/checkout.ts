import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_1RoNTA9HcTSLr7iBMv1ahEjs', // Replace with your Stripe price ID
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/`,
      cancel_url: `${req.headers.origin}/`,
    });
    res.status(200).json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: 'Payment failed' });
  }
}