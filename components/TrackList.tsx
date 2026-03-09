"use client";

import Image from "next/image";
import type { ArtistData } from "@/lib/spotify";

export default function TrackList({ artist }: { artist: ArtistData }) {
  const { topTracks, latestRelease, monthsAgoLastRelease } = artist;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Tracks */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Top Tracks
        </h2>
        <div className="flex flex-col gap-2">
          {topTracks.map((track, i) => (
            <a
              key={track.id}
              href={track.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 p-3 rounded-xl bg-[#0e0e0e] border border-[#1e1e1e] hover:border-[#6366f1]/40 hover:bg-[#12121f] transition-all"
            >
              {/* Rank */}
              <span className="text-xs font-mono text-zinc-600 w-4 text-center shrink-0">
                {i + 1}
              </span>

              {/* Album art */}
              {track.albumArt ? (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <Image
                    src={track.albumArt}
                    alt={track.name}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#1e1e1e] flex items-center justify-center shrink-0">
                  <span className="text-lg">🎵</span>
                </div>
              )}

              {/* Track name + streams */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-[#a5b4fc] transition-colors">
                  {track.name}
                </p>
                <p className="text-xs text-zinc-500">{track.streamEstimate} streams est.</p>
              </div>

              {/* Popularity bar */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-20 h-1 bg-[#1e1e1e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#6366f1] to-[#818cf8] rounded-full"
                    style={{ width: `${track.popularity}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-600 w-6 text-right">{track.popularity}</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Latest Release */}
      {latestRelease && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Latest Release
          </h2>
          <a
            href={latestRelease.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 p-4 rounded-xl bg-[#0e0e0e] border border-[#1e1e1e] hover:border-[#6366f1]/40 hover:bg-[#12121f] transition-all"
          >
            {latestRelease.albumArt ? (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                <Image
                  src={latestRelease.albumArt}
                  alt={latestRelease.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-[#1e1e1e] flex items-center justify-center shrink-0">
                <span className="text-2xl">💿</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate group-hover:text-[#a5b4fc] transition-colors">
                {latestRelease.name}
              </p>
              <p className="text-xs text-zinc-500 capitalize mt-0.5">
                {latestRelease.type} · {latestRelease.totalTracks}{" "}
                {latestRelease.totalTracks === 1 ? "track" : "tracks"}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {new Date(latestRelease.releaseDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            {monthsAgoLastRelease !== null && (
              <div className="shrink-0 text-right">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                    monthsAgoLastRelease <= 2
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                      : monthsAgoLastRelease <= 5
                        ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25"
                        : "bg-red-500/15 text-red-400 border border-red-500/25"
                  }`}
                >
                  {monthsAgoLastRelease === 0
                    ? "This month"
                    : monthsAgoLastRelease === 1
                      ? "1 month ago"
                      : `${monthsAgoLastRelease}mo ago`}
                </span>
              </div>
            )}
          </a>
        </div>
      )}
    </div>
  );
}
