export const dynamic = "force-dynamic";

import { kvGet } from "@/lib/kv";
import type { OneSheetData } from "@/lib/types";
import { formatNumber } from "@/lib/spotify";

interface Props {
  params: Promise<{ artistSlug: string }>;
}

function NoDataPage({ slug }: { slug: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-6 px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-[#1a1a1a] flex items-center justify-center text-3xl">🎵</div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white capitalize">{slug.replace(/-/g, " ")}</h1>
          <p className="text-xs text-zinc-500 mt-1">Artist links page</p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <a
            href={`https://open.spotify.com/search/${encodeURIComponent(slug.replace(/-/g, " "))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full bg-[#111] border border-[#1e1e1e] hover:bg-[#1a1a1a] rounded-xl px-4 py-3.5 text-sm font-medium text-white transition-colors"
          >
            <span>🎵</span>
            <span>Listen on Spotify</span>
          </a>
          <a
            href="https://helmos.co"
            className="flex items-center justify-center gap-2 w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-2"
          >
            Add more links at helmos.co →
          </a>
        </div>
      </div>
    </div>
  );
}

export default async function LinksPage({ params }: Props) {
  const { artistSlug } = await params;
  const data = await kvGet<OneSheetData>(`onesheet:${artistSlug}`);

  if (!data) return <NoDataPage slug={artistSlug} />;

  const socialLinks = [
    data.socialLinks.instagram && { icon: "📸", label: "Instagram", url: data.socialLinks.instagram },
    data.socialLinks.tiktok && { icon: "🎬", label: "TikTok", url: data.socialLinks.tiktok },
    data.socialLinks.youtube && { icon: "▶️", label: "YouTube", url: data.socialLinks.youtube },
    data.socialLinks.website && { icon: "🌐", label: "Website", url: data.socialLinks.website },
  ].filter(Boolean) as { icon: string; label: string; url: string }[];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center px-4 py-12 pb-20">
      <div className="w-full max-w-[480px] flex flex-col items-center gap-6">

        {/* Artist photo + name */}
        {data.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.photoUrl}
            alt={data.artistName}
            className="w-24 h-24 rounded-full object-cover ring-2 ring-white/10 shadow-2xl"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-[#1a1a1a] flex items-center justify-center text-3xl">🎵</div>
        )}

        <div className="text-center">
          <h1 className="text-xl font-bold text-white">{data.artistName}</h1>
          <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
            {data.monthlyListeners > 0 && (
              <span className="text-xs text-zinc-500">{formatNumber(data.monthlyListeners)} monthly listeners</span>
            )}
            {data.genres.length > 0 && data.monthlyListeners > 0 && (
              <span className="text-zinc-700">·</span>
            )}
            {data.genres.slice(0, 2).map((g) => (
              <span key={g} className="text-xs text-zinc-500">{g}</span>
            ))}
          </div>
        </div>

        {/* Link buttons */}
        <div className="flex flex-col gap-3 w-full">

          {/* Spotify */}
          {data.socialLinks.spotify && (
            <a
              href={data.socialLinks.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full bg-[#111] border border-[#1e1e1e] hover:bg-[#1a1a1a] rounded-xl px-4 py-3.5 text-sm font-medium text-white transition-colors"
            >
              <span>🎵</span>
              <span>Listen on Spotify</span>
            </a>
          )}

          {/* Latest Release */}
          {data.latestRelease && (
            <a
              href={data.latestRelease.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full bg-[#111] border border-[#1e1e1e] hover:bg-[#1a1a1a] rounded-xl px-4 py-3.5 transition-colors"
            >
              {data.latestRelease.albumArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.latestRelease.albumArt}
                  alt={data.latestRelease.name}
                  className="w-8 h-8 rounded object-cover shrink-0"
                />
              ) : (
                <span>🎧</span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">🎧 {data.latestRelease.name}</p>
                <p className="text-[10px] text-zinc-500">Latest release</p>
              </div>
            </a>
          )}

          {/* One-Sheet link */}
          <a
            href={`https://helmos.co/${artistSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full bg-[#111] border border-[#1e1e1e] hover:bg-[#1a1a1a] rounded-xl px-4 py-3.5 text-sm font-medium text-white transition-colors"
          >
            <span>📄</span>
            <span>Artist One-Sheet</span>
          </a>

          {/* Social links */}
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full bg-[#111] border border-[#1e1e1e] hover:bg-[#1a1a1a] rounded-xl px-4 py-3.5 text-sm font-medium text-white transition-colors"
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </a>
          ))}

          {/* Booking */}
          {data.bookingEmail && (
            <a
              href={`mailto:${data.bookingEmail}`}
              className="flex items-center gap-3 w-full bg-[#111] border border-[#1e1e1e] hover:bg-[#1a1a1a] rounded-xl px-4 py-3.5 text-sm font-medium text-white transition-colors"
            >
              <span>💌</span>
              <span>Book {data.artistName}</span>
            </a>
          )}
        </div>

        {/* Footer */}
        <a
          href="https://helmos.co"
          className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors mt-4"
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
