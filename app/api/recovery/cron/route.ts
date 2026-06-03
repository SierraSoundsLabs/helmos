// Daily cron — fires the T+3d and T+7d touches of the win-back drip.
// Vercel hits this once a day per vercel.json. Protected by CRON_SECRET
// in the Authorization header (Vercel's cron runner sets it
// automatically; manual hits need to match).

import { NextRequest, NextResponse } from "next/server";
import { runRecoveryCron } from "@/lib/recovery";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runRecoveryCron();
  return NextResponse.json({ ok: true, ...result });
}
