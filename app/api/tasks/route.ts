import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserTasks } from "@/lib/tasks";

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid && !req.nextUrl.searchParams.get("demo")) {
    return NextResponse.json({ error: "Not subscribed" }, { status: 403 });
  }

  const artistId = req.nextUrl.searchParams.get("artist") ?? session?.artistId;
  if (!artistId) return NextResponse.json({ tasks: [] });

  const userId = artistId; // for now, userId = artistId
  const tasks = await getUserTasks(userId);
  return NextResponse.json({ tasks });
}
