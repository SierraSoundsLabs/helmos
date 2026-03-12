"use client";

import type { ArtistData } from "@/lib/spotify";

export default function TrackList({ artist }: { artist: ArtistData }) {
  const { topTracks, latestRelease, monthsAgoLastRelease } = artist;

  if (!topTracks.length && !latestRelease) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Tracks */}
      {topTracks.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Top Tracks
          </h2>
          <div className="flex flex-col gap-1.5">
            {topTracks.map((track, i) => (
              <a
                key={track.id}
                href={track.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 p-3 rounded-xl hover:bg-[#141414] transition-all"
              >
                <span className="text-xs font-mono text-zinc-600 w-4 text-center shrink-0">{i + 1}</span>
                {track.albumArt ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={track.albumArt} alt={track.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-[#1e1e1e] flex items-center justify-center shrink-0">
                    <span className="text-base">🎵</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#a5b4fc] transition-colors">
                    {track.name}
                  </p>
                  <p className="text-xs text-zinc-600">{track.streamEstimate} streams est.</p>
                </div>
                <div className="w-16 h-1 bg-[#1e1e1e] rounded-full overflow-hidden shrink-0">
                  <div className="h-full bg-gradient-to-r from-[#6366f1] to-[#818cf8] rounded-full" style={{ width: `${track.popularity}%` }} />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Latest Release */}
      {latestRelease && (
        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Latest Release
          </h2>
          <a
            href={latestRelease.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 p-4 rounded-xl bg-[#0d0d0d] border border-[#1e1e1e] hover:border-[#6366f1]/40 transition-all"
          >
            {latestRelease.albumArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={latestRelease.albumArt} alt={latestRelease.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-[#1e1e1e] flex items-center justify-center shrink-0">
                <span className="text-2xl">💿</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{latestRelease.name}</p>
              <p className="text-xs text-zinc-500 capitalize mt-0.5">
                {latestRelease.type} · {latestRelease.totalTracks} {latestRelease.totalTracks === 1 ? "track" : "tracks"}
              </p>
              <p className="text-xs text-zinc-600 mt-0.5">
                {new Date(latestRelease.releaseDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
            {monthsAgoLastRelease !== null && (
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
                monthsAgoLastRelease <= 2 ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                : monthsAgoLastRelease <= 5 ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25"
                : "bg-red-500/15 text-red-400 border border-red-500/25"
              }`}>
                {monthsAgoLastRelease === 0 ? "This month" : `${monthsAgoLastRelease}mo ago`}
              </span>
            )}
          </a>
        </div>
      )}
    </div>
  );
}
