export interface OneSheetData {
  artistId: string;
  artistName: string;
  slug: string;
  bio: string;
  photoUrl: string;
  genres: string[];
  location?: string;
  monthlyListeners: number;
  spotifyFollowers?: number;
  topTracks: { name: string; spotifyUrl: string; albumArt: string; streams?: number }[];
  latestRelease: { name: string; date: string; albumArt: string; spotifyUrl: string } | null;
  socialLinks: {
    spotify?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    website?: string;
  };
  pressQuotes?: string[];
  bookingEmail?: string;
  createdAt: string;
}

export type OpportunityType = "festival" | "playlist" | "press" | "tiktok_growth" | "sync";
export type OpportunityStatus = "new" | "approved" | "done" | "dismissed";

export interface OpportunityTask {
  id: string;
  userEmail: string;
  artistId: string;
  artistName: string;
  type: OpportunityType;
  title: string;
  description: string;
  actionUrl?: string;
  deadline?: string;
  status: OpportunityStatus;
  createdAt: string;
  updatedAt: string;
}

export function artistSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
