import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getUserOpportunities } from "@/lib/tasks";
import type { OpportunityStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") as OpportunityStatus | null;

  const opportunities = await getUserOpportunities(
    session.email,
    statusFilter ?? undefined,
  );

  return new Response(JSON.stringify({ opportunities }), {
    headers: { "Content-Type": "application/json" },
  });
}
