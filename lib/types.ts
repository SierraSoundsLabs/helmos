export interface OneSheetData {
  artistId: string;
  artistName: string;
  slug: string;
  bio: string;
  photoUrl: string;
  genres: string[];
  monthlyListeners: number;
  topTracks: { name: string; spotifyUrl: string; albumArt: string }[];
  latestRelease: { name: string; date: string; albumArt: string; spotifyUrl: string } | null;
  socialLinks: {
    spotify?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    website?: string;
  };
  bookingEmail?: string;
  createdAt: string;
}

export function artistSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
