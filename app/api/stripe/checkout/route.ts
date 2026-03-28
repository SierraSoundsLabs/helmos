import { NextRequest, NextResponse } from "next/server";
import { kvGet } from "@/lib/kv";

const PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || "price_1TEhpZAq0rXznfHsHbKsyttZ"; // Helmos Pro $29/mo
const BASE_URL = "https://helmos.co";

export async function POST(req: NextRequest) {
  const { artistId } = await req.json();
  if (!artistId) return NextResponse.json({ error: "Missing artistId" }, { status: 400 });

  // Block signup if this artist already has an active Helm account
  const claimed = await kvGet<boolean>(`helm:artist_claimed:${artistId}`);
  if (claimed) {
    return NextResponse.json(
      { error: "This artist already has a Helm account. If this is you, sign in instead.", claimed: true },
      { status: 409 }
    );
  }

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": PRICE_ID,
    "line_items[0][quantity]": "1",
    success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&artist=${artistId}`,
    cancel_url: `${BASE_URL}/dashboard?artist=${artistId}`,
    "metadata[artist_id]": artistId,
    allow_promotion_codes: "true",
    "subscription_data[trial_period_days]": "3",
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const session = await res.json();
  if (!res.ok) {
    console.error("Stripe checkout error:", session.error);
    return NextResponse.json({ error: session.error?.message || "Failed to create session" }, { status: 400 });
  }

  return NextResponse.json({ url: session.url });
}
