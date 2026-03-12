import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const hasToken = !!cookieStore.get("spotify_access_token")?.value;
  const hasRefresh = !!cookieStore.get("spotify_refresh_token")?.value;
  return NextResponse.json({ connected: hasToken || hasRefresh });
}
