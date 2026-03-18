import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encodeSession, COOKIE_NAME, TTL } from "@/lib/session";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY!;

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  return res.json();
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  try {
    // Find customer by email
    const customers = await stripeGet(`/customers?email=${encodeURIComponent(email)}&limit=5`);
    if (!customers.data?.length) {
      return NextResponse.json({ error: "No subscription found for that email." }, { status: 404 });
    }

    let customerId = "";
    let artistId = "";

    for (const customer of customers.data) {
      // Check completed checkout sessions for this customer
      const sessions = await stripeGet(`/checkout/sessions?customer=${customer.id}&limit=10`);
      const paidSession = sessions.data?.find(
        (s: { payment_status: string; status: string; metadata?: { artist_id?: string } }) =>
          s.payment_status === "paid" || s.status === "complete"
      );
      if (paidSession) {
        customerId = customer.id;
        artistId = paidSession.metadata?.artist_id ?? "";
        break;
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: "No paid subscription found for that email." }, { status: 404 });
    }

    // Re-issue session cookie
    const token = encodeSession({ email, artistId, customerId, plan: "heatseeker" });
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      maxAge: TTL,
      path: "/",
      sameSite: "lax",
    });

    const dashboardUrl = artistId ? `/dashboard?artist=${artistId}` : "/intake";
    return NextResponse.json({ ok: true, dashboardUrl });
  } catch (err) {
    console.error("restore error", err);
    return NextResponse.json({ error: "Could not verify subscription." }, { status: 500 });
  }
}
