import { NextRequest, NextResponse } from "next/server";
import { kvGet } from "@/lib/kv";
import type { OneSheetData } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await kvGet<OneSheetData>(`onesheet:${slug}`);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
