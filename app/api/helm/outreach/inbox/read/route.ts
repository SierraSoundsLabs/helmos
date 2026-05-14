import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";
import type { InboundEmail } from "@/app/api/helm/outreach/webhook/route";

// POST /api/helm/outreach/inbox/read
// Body: { artistSlug, ids: string[], read: boolean }
//
// Marks one or more inbound messages as read or unread. Used by the
// dashboard inbox UI when the artist views a message.
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({})) as {
    artistSlug?: string;
    ids?: string[];
    read?: boolean;
  };

  const artistSlug = body.artistSlug?.toLowerCase();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const read = body.read !== false; // default true

  if (!artistSlug || ids.length === 0) {
    return new Response(JSON.stringify({ error: "artistSlug and ids required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  let updated = 0;
  for (const id of ids) {
    const key = `inbox:${artistSlug}:${id}`;
    const email = await kvGet<InboundEmail>(key);
    if (email) {
      await kvSet(key, { ...email, read });
      updated++;
    }
  }

  return new Response(JSON.stringify({ ok: true, updated }), {
    headers: { "Content-Type": "application/json" },
  });
}
