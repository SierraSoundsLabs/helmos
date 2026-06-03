// Unsubscribe endpoint for the win-back drip. Marks the recovery record
// as opted-out so future cron touches are skipped, then redirects to a
// confirmation page. CAN-SPAM-compliant: one-click, no login required.

import { NextRequest, NextResponse } from "next/server";
import { markUnsubscribed } from "@/lib/recovery";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email") || "";
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!email || !token) {
    return NextResponse.redirect(new URL("/recovery/unsubscribed?status=missing", req.url));
  }
  const ok = await markUnsubscribed(email, token);
  return NextResponse.redirect(new URL(`/recovery/unsubscribed?status=${ok ? "ok" : "invalid"}`, req.url));
}
