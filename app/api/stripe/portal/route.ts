// NOTE: The Stripe billing portal must be configured at:
// https://dashboard.stripe.com/settings/billing/portal
// Enable it and set the return URL to https://helmos.co/account

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
const BASE_URL = "https://helmos.co";

async function findOrCacheCustomerId(email: string, sessionCustomerId: string): Promise<string | null> {
  // Check KV cache first
  const cached = await kvGet<string>(`helm:user:${email}:stripe_customer_id`);
  if (cached) return cached;

  // Use the customer ID from session if present
  if (sessionCustomerId) {
    await kvSet(`helm:user:${email}:stripe_customer_id`, sessionCustomerId);
    return sessionCustomerId;
  }

  // Fall back to searching Stripe by email
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length === 0) return null;

  const customerId = customers.data[0].id;
  await kvSet(`helm:user:${email}:stripe_customer_id`, customerId);
  return customerId;
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customerId = await findOrCacheCustomerId(session.email, session.customerId);
  if (!customerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${BASE_URL}/account`,
  });

  return NextResponse.json({ url: portalSession.url });
}
