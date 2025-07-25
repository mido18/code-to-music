import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

export async function POST(req: NextRequest, res: NextResponse) {
  try {
    const origin = req.headers.get('origin');
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_1RoNTA9HcTSLr7iBMv1ahEjs',
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/?success=true`,
      cancel_url: `${origin}/?cancel=true`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Checkout Error:', error);

    return new Response(JSON.stringify({ error: 'Payment failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
