import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet } from "@/lib/kv";
import type { OutreachRecord } from "@/app/api/helm/outreach/send/route";

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const artistId = searchParams.get("artistId");
  if (!artistId) {
    return new Response(JSON.stringify({ error: "artistId required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const idsKey = `outreach-ids:${artistId}`;
  const ids = (await kvGet<string[]>(idsKey)) ?? [];

  const records = await Promise.all(
    ids.map(id => kvGet<OutreachRecord>(`outreach:${artistId}:${id}`))
  );

  const valid = records
    .filter((r): r is OutreachRecord => r !== null)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  return new Response(JSON.stringify({ records: valid }), {
    headers: { "Content-Type": "application/json" },
  });
}
