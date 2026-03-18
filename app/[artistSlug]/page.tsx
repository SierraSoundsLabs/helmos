export const dynamic = "force-dynamic";

import { kvGet } from "@/lib/kv";
import type { OneSheetData } from "@/lib/types";
import { formatNumber } from "@/lib/spotify";
import Link from "next/link";

interface Props {
  params: Promise<{ artistSlug: string }>;
}

// ─── 404 page ─────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center flex flex-col gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center mx-auto">
          <span className="text-2xl font-bold text-white">H</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Artist not found</h1>
        <p className="text-zinc-400 text-sm max-w-xs">
          This artist page doesn&apos;t exist yet. Are you an artist? Create your profile at Helmos.
        </p>
      </div>
      <Link
        href="https://helmos.co"
        className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] transition-colors"
      >
        Go to Helmos →
      </Link>
    </div>
  );
}

// ─── Social icon map ──────────────────────────────────────────────────────────
function SocialIcon({ platform }: { platform: string }) {
  const icons: Record<string, string> = {
    spotify: "🎵",
    instagram: "📸",
    tiktok: "🎬",
    youtube: "▶️",
    website: "🌐",
  };
  return <span>{icons[platform] ?? "🔗"}</span>;
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default async function ArtistOneSheePage({ params }: Props) {
  const { artistSlug } = await params;
  const data = await kvGet<OneSheetData>(`onesheet:${artistSlug}`);

  if (!data) return <NotFound />;

  const socialEntries = Object.entries(data.socialLinks).filter(([, v]) => !!v) as [string, string][];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        {/* Blurred background */}
        {data.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.photoUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-110"
            aria-hidden="true"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/60 to-[#0a0a0a]" />

        <div className="relative max-w-3xl mx-auto px-4 pt-16 pb-12 flex flex-col items-center gap-6">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.photoUrl}
              alt={data.artistName}
              className="w-32 h-32 sm:w-44 sm:h-44 rounded-full object-cover ring-4 ring-white/10 shadow-2xl"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-[#1a1a1a] flex items-center justify-center text-5xl">🎵</div>
          )}

          <div className="text-center">
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">{data.artistName}</h1>
            {data.monthlyListeners > 0 && (
              <p className="text-zinc-400 text-sm mt-2">
                {formatNumber(data.monthlyListeners)} monthly listeners
              </p>
            )}
            {data.genres.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {data.genres.map((g) => (
                  <span key={g} className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-zinc-300 border border-white/10">
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 pb-20 flex flex-col gap-10">

        {/* Bio */}
        {data.bio && (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">About</h2>
            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{data.bio}</p>
          </section>
        )}

        {/* Latest Release */}
        {data.latestRelease && (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Latest Release</h2>
            <a
              href={data.latestRelease.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#6366f1]/40 hover:bg-[#12121a] transition-all group"
            >
              {data.latestRelease.albumArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.latestRelease.albumArt}
                  alt={data.latestRelease.name}
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-2xl shrink-0">💿</div>
              )}
              <div className="min-w-0">
                <p className="text-base font-semibold text-white group-hover:text-[#a5b4fc] transition-colors truncate">
                  {data.latestRelease.name}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">{data.latestRelease.date}</p>
              </div>
              <span className="ml-auto text-xs text-[#6366f1] shrink-0">Listen →</span>
            </a>
          </section>
        )}

        {/* Top Tracks */}
        {data.topTracks.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Top Tracks</h2>
            <div className="flex flex-col gap-2">
              {data.topTracks.map((track, i) => (
                <a
                  key={i}
                  href={track.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#6366f1]/40 hover:bg-[#12121a] transition-all group"
                >
                  <span className="text-xs text-zinc-600 font-mono w-4 shrink-0">{i + 1}</span>
                  {track.albumArt ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.albumArt} alt={track.name} className="w-9 h-9 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded bg-[#1a1a1a] shrink-0" />
                  )}
                  <span className="text-sm font-medium text-white group-hover:text-[#a5b4fc] transition-colors truncate">{track.name}</span>
                  <span className="ml-auto text-[10px] text-zinc-600 shrink-0">🎵</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Social Links */}
        {socialEntries.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Connect</h2>
            <div className="flex flex-wrap gap-2">
              {socialEntries.map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#6366f1]/40 hover:bg-[#12121a] transition-all text-sm font-medium text-zinc-300 capitalize"
                >
                  <SocialIcon platform={platform} />
                  {platform}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Booking */}
        {data.bookingEmail && (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Booking</h2>
            <a
              href={`mailto:${data.bookingEmail}`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#6366f1]/40 hover:bg-[#12121a] transition-all text-sm font-medium text-zinc-300"
            >
              <span>💌</span>
              <span>Book {data.artistName}</span>
            </a>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#1a1a1a] py-6 flex justify-center">
        <a
          href="https://helmos.co"
          className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <div className="w-4 h-4 rounded bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">H</span>
          </div>
          Powered by Helm
        </a>
      </div>
    </div>
  );
}
