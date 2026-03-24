import { NextRequest, NextResponse } from "next/server";

const PRICE_ID = "price_1TEZNKAq0rXznfHsTI2kXoVX"; // Helmos Pro $19/mo — Sierra Sounds LLC
const BASE_URL = "https://helmos.co";

export async function POST(req: NextRequest) {
  const { artistId } = await req.json();
  if (!artistId) return NextResponse.json({ error: "Missing artistId" }, { status: 400 });

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": PRICE_ID,
    "line_items[0][quantity]": "1",
    success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&artist=${artistId}`,
    cancel_url: `${BASE_URL}/dashboard?artist=${artistId}`,
    "metadata[artist_id]": artistId,
    allow_promotion_codes: "true",
    "subscription_data[trial_period_days]": "7",
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
