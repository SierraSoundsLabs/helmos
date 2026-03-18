import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encodeSession, COOKIE_NAME, TTL } from "@/lib/session";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  try {
    // Find customer by email
    const customers = await stripe.customers.list({ email, limit: 5 });
    if (!customers.data.length) {
      return NextResponse.json({ error: "No subscription found for that email." }, { status: 404 });
    }

    // Check for active subscription
    let customerId = "";
    let artistId = "";

    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 1,
      });
      if (subs.data.length) {
        customerId = customer.id;
        // Try to find artist_id from most recent completed checkout session
        const sessions = await stripe.checkout.sessions.list({
          customer: customer.id,
          limit: 5,
        });
        const paidSession = sessions.data.find(s => s.payment_status === "paid" || s.status === "complete");
        artistId = paidSession?.metadata?.artist_id ?? "";
        break;
      }
      // Also check one-time payments (no subscription model)
      const sessions = await stripe.checkout.sessions.list({
        customer: customer.id,
        limit: 5,
      });
      const paidSession = sessions.data.find(s => s.payment_status === "paid" || s.status === "complete");
      if (paidSession) {
        customerId = customer.id;
        artistId = paidSession.metadata?.artist_id ?? "";
        break;
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: "No active subscription found for that email." }, { status: 404 });
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
