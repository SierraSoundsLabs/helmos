import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvDel } from "@/lib/kv";
import { findStripeCustomer } from "@/lib/stripe";
import {
  makeNewPasswordRecord,
  type PasswordRecord,
} from "@/lib/password";
import { buildSessionAndRedirect, isFounderEmail } from "@/lib/auth";

interface ResetTokenData {
  email: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json(
      { error: "Invalid reset link." },
      { status: 400 }
    );
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  try {
    const tokenKey = `helm:reset_token:${token}`;
    const data = await kvGet<ResetTokenData>(tokenKey);
    if (!data) {
      return NextResponse.json(
        { error: "This link has expired or already been used. Request a new one." },
        { status: 400 }
      );
    }

    const email = data.email.trim().toLowerCase();

    // Hash and store the new password — overwrites any existing record
    const record = await makeNewPasswordRecord(password);
    await kvSet(`helm:password:${email}`, record satisfies PasswordRecord);

    // Consume the token — one-time use
    await kvDel(tokenKey);

    // Look up Stripe customer to build a session. Founders (operator
    // emails) skip the paid-subscription check — the password is now
    // stored either way, but we still need to decide whether to issue
    // a session cookie.
    const founder = isFounderEmail(email);
    const customer = founder ? null : await findStripeCustomer(email);
    if (!founder && !customer) {
      // Edge case: subscription was canceled between request and confirm.
      // Password is set, but no session.
      return NextResponse.json(
        {
          error: "Password set, but your subscription is no longer active. Please subscribe to sign in.",
          code: "no_subscription",
        },
        { status: 403 }
      );
    }

    return buildSessionAndRedirect(
      email,
      customer?.customerId ?? "",
      customer?.artistId ?? ""
    );
  } catch (err) {
    console.error("reset-password/confirm error", err);
    return NextResponse.json(
      { error: "Failed to set password. Please try again." },
      { status: 500 }
    );
  }
}
