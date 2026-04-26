export const dynamic = "force-dynamic";

import { kvGet } from "@/lib/kv";
import type { SongLink } from "@/app/api/helm/song-link/route";

interface Props {
  params: Promise<{ artistSlug: string; songSlug: string }>;
}

const PLATFORM_CONFIG: { key: keyof SongLink; icon: string; label: string; color: string }[] = [
  { key: "presaveUrl",    icon: "🔔", label: "Pre-Save",       color: "border-amber-500/40 hover:border-amber-400/60" },
  { key: "spotifyUrl",    icon: "🎵", label: "Spotify",        color: "border-[#1DB954]/40 hover:border-[#1DB954]/70" },
  { key: "appleMusicUrl", icon: "🍎", label: "Apple Music",    color: "border-[#fc3c44]/40 hover:border-[#fc3c44]/70" },
  { key: "youtubeUrl",    icon: "▶️", label: "YouTube",        color: "border-[#FF0000]/40 hover:border-[#FF0000]/70" },
  { key: "soundcloudUrl", icon: "☁️", label: "SoundCloud",     color: "border-[#FF5500]/40 hover:border-[#FF5500]/70" },
  { key: "tidalUrl",      icon: "🌊", label: "Tidal",          color: "border-zinc-400/40 hover:border-zinc-300/70" },
  { key: "amazonUrl",     icon: "🛍️", label: "Amazon Music",   color: "border-[#00A8E0]/40 hover:border-[#00A8E0]/70" },
];

export default async function SongLinkPage({ params }: Props) {
  const { artistSlug, songSlug } = await params;
  const id = `${artistSlug}-${songSlug}`;
  const link = await kvGet<SongLink>(`helm:song-link:${id}`);

  if (!link) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-2xl mb-3">🎵</p>
          <p className="text-sm text-zinc-500">Song link not found</p>
          <a href="https://helmos.co" className="text-xs text-[#6366f1] hover:text-[#818cf8] mt-3 inline-block">
            Create your smart link at helmos.co →
          </a>
        </div>
      </div>
    );
  }

  const platformLinks = PLATFORM_CONFIG.filter(p => link[p.key]);
  const hasPresave = !!link.presaveUrl;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center px-4 py-12 pb-20">
      <div className="w-full max-w-[400px] flex flex-col items-center gap-6">

        {/* Album art */}
        {link.albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.albumArt}
            alt={link.songName}
            className="w-48 h-48 rounded-2xl object-cover shadow-2xl shadow-black/50"
          />
        ) : (
          <div className="w-48 h-48 rounded-2xl bg-[#1a1a1a] flex items-center justify-center text-5xl shadow-2xl">🎵</div>
        )}

        {/* Song + artist info */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">{link.songName}</h1>
          <a
            href={`https://helmos.co/links/${link.artistSlug}`}
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors mt-1 inline-block"
          >
            {link.artistName}
          </a>
          {link.releaseDate && (
            <p className="text-xs text-zinc-600 mt-1 capitalize">
              {link.releaseType || "Release"} · {link.releaseDate}
            </p>
          )}
        </div>

        {/* Bio/blurb */}
        {link.bio && (
          <p className="text-xs text-zinc-400 text-center leading-relaxed max-w-xs">{link.bio}</p>
        )}

        {/* Pre-save CTA — prominent if available */}
        {hasPresave && (
          <a
            href={link.presaveUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90 transition-opacity shadow-lg shadow-[#6366f1]/20"
          >
            🔔 Pre-Save Now
          </a>
        )}

        {/* Streaming platforms */}
        <div className="flex flex-col gap-3 w-full">
          {platformLinks.filter(p => p.key !== "presaveUrl").map((platform) => (
            <a
              key={platform.key}
              href={link[platform.key] as string}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 w-full bg-[#111] border ${platform.color} rounded-xl px-4 py-3.5 text-sm font-medium text-white transition-all hover:bg-[#151515]`}
            >
              <span className="text-lg">{platform.icon}</span>
              <span>Listen on {platform.label}</span>
            </a>
          ))}

          {/* Custom links */}
          {(link.customLinks || []).map((cl, i) => (
            <a
              key={i}
              href={cl.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full bg-[#111] border border-[#2e2e2e] hover:border-[#3e3e3e] rounded-xl px-4 py-3.5 text-sm font-medium text-white transition-all hover:bg-[#151515]"
            >
              <span>🔗</span>
              <span>{cl.label}</span>
            </a>
          ))}
        </div>

        {/* Back to artist */}
        <a
          href={`https://helmos.co/links/${link.artistSlug}`}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          More from {link.artistName} →
        </a>

        {/* Footer */}
        <a
          href="https://helmos.co"
          className="flex items-center gap-1.5 text-[11px] text-zinc-700 hover:text-zinc-500 transition-colors mt-2"
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
