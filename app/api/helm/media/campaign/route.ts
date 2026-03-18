import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { kvSet } from "@/lib/kv";

const BASE_URL = "https://helmos.co";

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { artistId, amount, campaignType, releaseId } = await req.json();

  if (!artistId || !amount || !campaignType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const amountCents = Math.round(Number(amount) * 100);
  if (amountCents < 1000) {
    return NextResponse.json({ error: "Minimum campaign spend is $10" }, { status: 400 });
  }

  const productName = `Helm Media Campaign — ${campaignType.charAt(0).toUpperCase() + campaignType.slice(1)}`;
  const successUrl = `${BASE_URL}/dashboard?artist=${artistId}&campaign=success`;
  const cancelUrl = `${BASE_URL}/dashboard?artist=${artistId}`;

  // Build Stripe Checkout Session for a one-time payment
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(amountCents),
    "line_items[0][price_data][product_data][name]": productName,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "metadata[artist_id]": artistId,
    "metadata[campaign_type]": campaignType,
    ...(releaseId ? { "metadata[release_id]": releaseId } : {}),
    allow_promotion_codes: "true",
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const stripeSession = await res.json();
  if (!res.ok) {
    console.error("Stripe campaign checkout error:", stripeSession.error);
    return NextResponse.json(
      { error: stripeSession.error?.message || "Failed to create checkout session" },
      { status: 400 }
    );
  }

  // Store campaign record in KV
  await kvSet(`media:campaign:${artistId}:${Date.now()}`, {
    artistId,
    campaignType,
    releaseId: releaseId || null,
    amount,
    stripeSessionId: stripeSession.id,
    createdAt: new Date().toISOString(),
    status: "pending_payment",
  });

  return NextResponse.json({ url: stripeSession.url });
}
