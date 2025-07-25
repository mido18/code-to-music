import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  // Stripe expects the raw body to construct the event. Next.js provides the body as a ReadableStream,
  // so we first read it as text then convert to a Buffer.
  const rawBody = await req.text();
  const buf = Buffer.from(rawBody);
  const sig = req.headers.get('stripe-signature') ?? '';
  console.log('Stripe webhook received:', rawBody);  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    if (userId) {
      try {
        await setDoc(doc(db, 'users', userId), { isPaid: true }, { merge: true });
        console.log(`Updated payment status for user ${userId}`);
      } catch (error) {
        console.error('Firestore update error:', error);
        return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 });
      }
    } else {
      console.error('No user ID found in checkout session metadata');
    }
  }

  return NextResponse.json({ received: true });
}
