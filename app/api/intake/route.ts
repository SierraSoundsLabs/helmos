import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { fetchArtistData } from "@/lib/spotify";
import { buildTaskList, createTasks, saveUserProfile, type UserProfile } from "@/lib/tasks";

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) {
    return NextResponse.json({ error: "Not subscribed" }, { status: 403 });
  }

  const body = await req.json();
  const { artistId, goals, hasRelease, releaseDate, releaseTitle, email } = body;

  if (!artistId || !goals?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Fetch artist data to populate task inputs
  let artistName = "Artist";
  let genres: string[] = ["Independent"];
  let monthlyListeners = 0;
  let latestRelease: string | undefined;

  try {
    const artist = await fetchArtistData(artistId);
    artistName = artist.name;
    genres = artist.genres?.length ? artist.genres : ["Independent"];
    monthlyListeners = artist.monthlyListeners;
    latestRelease = artist.latestRelease?.name;
  } catch {
    // Continue even if Spotify fetch fails — use defaults
  }

  const userId = session.artistId ?? artistId; // use artistId as user identifier for now

  const profile: UserProfile = {
    userId,
    artistId,
    artistName,
    goals,
    upcomingRelease: hasRelease,
    releaseDate: releaseDate || undefined,
    releaseTitle: releaseTitle || undefined,
    email: email || undefined,
    genres,
    monthlyListeners,
    latestRelease,
    createdAt: new Date().toISOString(),
  };

  await saveUserProfile(profile);

  const taskTypes = buildTaskList(goals, hasRelease);
  const tasks = await createTasks(profile, taskTypes);

  return NextResponse.json({ ok: true, taskCount: tasks.length });
}
