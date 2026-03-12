"use client";

import type { ArtistData } from "@/lib/spotify";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function ArtistCard({ artist }: { artist: ArtistData }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Artist image */}
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden ring-1 ring-white/10 bg-[#1a1a1a]">
        {artist.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl">🎵</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>

      {/* Name + Spotify link */}
      <div>
        <h1 className="text-2xl font-bold text-white leading-tight">{artist.name}</h1>
        <a
          href={artist.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#6366f1] hover:text-[#818cf8] transition-colors mt-1 inline-flex items-center gap-1"
        >
          View on Spotify ↗
        </a>
      </div>

      {/* Genres */}
      {artist.genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {artist.genres.slice(0, 4).map((genre) => (
            <span key={genre} className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#6366f1]/15 text-[#a5b4fc] border border-[#6366f1]/25">
              {genre}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0e0e0e] rounded-xl p-3.5 border border-[#1e1e1e]">
          <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Listeners</p>
          <p className="text-xl font-bold text-white">{artist.followers > 0 ? fmt(artist.followers) : "—"}</p>
        </div>
        <div className="bg-[#0e0e0e] rounded-xl p-3.5 border border-[#1e1e1e]">
          <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Spotify Score</p>
          <div className="flex items-end gap-1">
            <p className="text-xl font-bold text-white">{artist.spotifyPopularity}</p>
            <p className="text-xs text-zinc-500 mb-0.5">/100</p>
          </div>
        </div>
      </div>

      {/* Popularity bar */}
      <div>
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1.5">
          <span>Spotify Popularity</span>
          <span>{artist.spotifyPopularity}/100</span>
        </div>
        <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#6366f1] to-[#818cf8] rounded-full transition-all duration-1000"
            style={{ width: `${artist.spotifyPopularity}%` }}
          />
        </div>
        <p className="text-[10px] text-zinc-600 mt-1.5">
          {artist.spotifyPopularity >= 70 ? "Mainstream momentum" :
           artist.spotifyPopularity >= 50 ? "Growing fast" :
           artist.spotifyPopularity >= 30 ? "Building fanbase" : "Early stage"}
        </p>
      </div>

      {/* Top song */}
      {artist.topSong && (
        <div className="bg-[#0e0e0e] rounded-xl p-3.5 border border-[#1e1e1e]">
          <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider">Most Popular Song</p>
          <a href={artist.topSong.spotifyUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3">
            {artist.topSong.albumArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artist.topSong.albumArt} alt={artist.topSong.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center shrink-0 text-base">🎵</div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate group-hover:text-[#a5b4fc] transition-colors">{artist.topSong.name}</p>
              <p className="text-xs text-zinc-500">~{artist.topSong.streamEstimate} streams</p>
            </div>
          </a>
        </div>
      )}

      {/* Latest release */}
      {artist.latestRelease && (
        <div className="bg-[#0e0e0e] rounded-xl p-3.5 border border-[#1e1e1e]">
          <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider">Latest Release</p>
          <a href={artist.latestRelease.spotifyUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3">
            {artist.latestRelease.albumArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artist.latestRelease.albumArt} alt={artist.latestRelease.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center shrink-0 text-base">💿</div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{artist.latestRelease.name}</p>
              <p className="text-xs text-zinc-500">
                {artist.latestRelease.releaseDate}
                {artist.monthsAgoLastRelease != null && artist.monthsAgoLastRelease > 0 ? ` · ${artist.monthsAgoLastRelease}mo ago` : ""}
              </p>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}
