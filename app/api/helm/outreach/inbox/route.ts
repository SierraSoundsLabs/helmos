import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet } from "@/lib/kv";
import type { InboundEmail } from "@/app/api/helm/outreach/webhook/route";

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const artistSlug = searchParams.get("artistSlug");
  if (!artistSlug) {
    return new Response(JSON.stringify({ error: "artistSlug required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const idsKey = `inbox-ids:${artistSlug}`;
  const ids = (await kvGet<string[]>(idsKey)) ?? [];

  const emails = await Promise.all(
    ids.map(id => kvGet<InboundEmail>(`inbox:${artistSlug}:${id}`))
  );

  const valid = emails
    .filter((e): e is InboundEmail => e !== null)
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

  return new Response(JSON.stringify({ emails: valid }), {
    headers: { "Content-Type": "application/json" },
  });
}
