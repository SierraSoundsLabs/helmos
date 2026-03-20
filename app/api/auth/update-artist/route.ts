import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY!;

async function stripePost(path: string, body: Record<string, string>) {
  const params = new URLSearchParams(body).toString();
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  return res.json();
}

/**
 * POST /api/auth/update-artist
 * Body: { artistId: string }
 * Stores the new artistId in Stripe customer metadata (persistent).
 * Next magic link login will use this artist instead of the original signup artist.
 */
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) {
    return NextResponse.json({ error: "Not subscribed" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { artistId } = body;

  if (typeof artistId !== "string") {
    return NextResponse.json({ error: "artistId required" }, { status: 400 });
  }

  // Update Stripe customer metadata — persistent, survives cold starts
  await stripePost(`/customers/${session.customerId}`, {
    "metadata[artist_id]": artistId,
  });

  return NextResponse.json({ ok: true, artistId });
}

/**
 * DELETE /api/auth/update-artist
 * Clears the customer-level artist override.
 */
export async function DELETE(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) {
    return NextResponse.json({ error: "Not subscribed" }, { status: 403 });
  }

  await stripePost(`/customers/${session.customerId}`, {
    "metadata[artist_id]": "",
  });

  return NextResponse.json({ ok: true });
}
