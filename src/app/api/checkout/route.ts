import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const { userId } = (await request.json()) as { userId: string };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_1RoNTA9HcTSLr7iBMv1ahEjs',
          quantity: 1,
        },
      ],
      metadata: {
        userId,
      },
      mode: 'payment',
      success_url: `${origin}/?success=true`,
      cancel_url: `${origin}/?cancel=true`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error('Checkout Error:', error);

    return NextResponse.json({ error: 'Payment failed' }, { status: 500 });
  }
}
