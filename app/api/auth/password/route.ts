import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { findStripeCustomer } from "@/lib/stripe";
import {
  makeNewPasswordRecord,
  verifyPassword,
  type PasswordRecord,
} from "@/lib/password";
import { buildSessionAndRedirect, isFounderEmail } from "@/lib/auth";

// hashPassword/verifyPassword and buildSessionAndRedirect live in lib/
// (also used by /api/auth/reset-password/confirm).

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (action !== "register" && action !== "login") {
    return NextResponse.json(
      { error: 'Action must be "register" or "login"' },
      { status: 400 }
    );
  }

  const kvKey = `helm:password:${email}`;

  try {
    if (action === "register") {
      const existing = await kvGet<PasswordRecord>(kvKey);
      if (existing) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 }
        );
      }

      // Find Stripe customer — must have active subscription to register
      const customer = await findStripeCustomer(email);
      if (!customer) {
        return NextResponse.json(
          {
            error:
              "No active subscription found for this email. Please subscribe first.",
            code: "no_subscription",
          },
          { status: 403 }
        );
      }

      // Hash and store password
      const record = await makeNewPasswordRecord(password);
      await kvSet(kvKey, record satisfies PasswordRecord);

      return buildSessionAndRedirect(
        email,
        customer.customerId,
        customer.artistId
      );
    }

    // action === "login"
    const record = await kvGet<PasswordRecord>(kvKey);
    if (!record) {
      return NextResponse.json(
        { error: "No account or no password set. If you subscribed, use the reset link below to set one up." },
        { status: 401 }
      );
    }

    if (!(await verifyPassword(password, record))) {
      return NextResponse.json(
        { error: "Incorrect password." },
        { status: 401 }
      );
    }

    // Founder bypass: operator emails can log in without a paid Stripe
    // subscription. Empty customerId/artistId is fine — the redirect logic
    // in buildSessionAndRedirect handles the "logged in but no artist" case.
    const founder = isFounderEmail(email);
    const customer = founder ? null : await findStripeCustomer(email);
    if (!founder && !customer) {
      return NextResponse.json(
        {
          error:
            "No active subscription found for this email. Please subscribe first.",
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
    console.error("password auth error", err);
    return NextResponse.json(
      { error: "Authentication failed. Please try again." },
      { status: 500 }
    );
  }
}

