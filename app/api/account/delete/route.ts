import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { getSession, COOKIE_NAME } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { confirmation?: string };
  if (body.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Invalid confirmation" }, { status: 400 });
  }

  const email = session.email;

  // Get Stripe customer ID (from KV cache or session)
  const cachedCustomerId = await kvGet<string>(`helm:user:${email}:stripe_customer_id`);
  const customerId = cachedCustomerId || session.customerId;

  // Cancel all active Stripe subscriptions
  if (customerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
      });
      await Promise.all(
        subscriptions.data.map(sub => stripe.subscriptions.cancel(sub.id))
      );

      // Also check trialing subscriptions
      const trialing = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
      });
      await Promise.all(
        trialing.data.map(sub => stripe.subscriptions.cancel(sub.id))
      );
    } catch (err) {
      console.error("Error cancelling Stripe subscriptions:", err);
      // Continue with account deletion even if Stripe cancellation fails
    }
  }

  // Soft delete: record deletedAt timestamp (don't purge all KV data immediately)
  await kvSet(`helm:user:${email}:deleted`, {
    deletedAt: new Date().toISOString(),
    customerId: customerId || null,
  });

  // Clear session cookie
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });

  return NextResponse.json({ success: true });
}
