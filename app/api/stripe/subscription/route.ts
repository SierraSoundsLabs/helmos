import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSession } from "@/lib/session";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customerId = req.nextUrl.searchParams.get("customerId") || session.customerId;
  if (!customerId) {
    return NextResponse.json(null);
  }

  // Get active or trialing subscriptions for this customer
  const [active, trialing] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
    stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
  ]);

  const sub = active.data[0] ?? trialing.data[0] ?? null;
  if (!sub) {
    return NextResponse.json(null);
  }

  const item = sub.items.data[0];
  const price = item?.price;

  // billing_cycle_anchor is the anchor date for the subscription cycle
  // Use it as a proxy for the next billing date
  const nextBillingDate = sub.billing_cycle_anchor ?? null;

  return NextResponse.json({
    status: sub.status,
    plan: price?.nickname ?? "Helmos Pro",
    interval: price?.recurring?.interval ?? "month",
    amount: price?.unit_amount ?? 0,
    currentPeriodEnd: nextBillingDate,
    trialEnd: sub.trial_end ?? null,
  });
}
