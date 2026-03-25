import { NextRequest, NextResponse } from "next/server";
import { kvGet } from "@/lib/kv";
import type { OneSheetData } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ artistSlug: string }> }
) {
  const { artistSlug } = await params;
  const data = await kvGet<OneSheetData>(`onesheet:${artistSlug}`);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
