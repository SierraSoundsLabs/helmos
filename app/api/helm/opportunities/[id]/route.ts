import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getOpportunity, updateOpportunity } from "@/lib/tasks";
import type { OpportunityStatus } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;
  const existing = await getOpportunity(id);

  if (!existing) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  if (existing.userEmail !== session.email) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json() as { status?: OpportunityStatus };
  const validStatuses: OpportunityStatus[] = ["new", "approved", "done", "dismissed"];

  if (!body.status || !validStatuses.includes(body.status)) {
    return new Response(JSON.stringify({ error: "Invalid status" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const updated = await updateOpportunity(id, { status: body.status });

  return new Response(JSON.stringify({ opportunity: updated }), {
    headers: { "Content-Type": "application/json" },
  });
}
