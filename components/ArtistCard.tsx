"use client";

import Image from "next/image";
import type { ArtistData } from "@/lib/spotify";

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function ArtistCard({ artist }: { artist: ArtistData }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Artist image */}
      <div className="relative">
        {artist.image ? (
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden ring-1 ring-white/10">
            <Image
              src={artist.image}
              alt={artist.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 280px"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="w-full aspect-square rounded-2xl bg-[#1e1e1e] ring-1 ring-white/10 flex items-center justify-center">
            <span className="text-6xl">🎵</span>
          </div>
        )}
      </div>

      {/* Artist info */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">{artist.name}</h1>
          <a
            href={artist.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#6366f1] hover:text-[#818cf8] transition-colors mt-1 inline-block"
          >
            View on Spotify ↗
          </a>
        </div>

        {/* Genres */}
        {artist.genres.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {artist.genres.slice(0, 4).map((genre) => (
              <span
                key={genre}
                className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#6366f1]/15 text-[#a5b4fc] border border-[#6366f1]/25"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0e0e0e] rounded-xl p-3.5 border border-[#1e1e1e]">
            <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Followers</p>
            <p className="text-xl font-bold text-white">{formatFollowers(artist.followers)}</p>
          </div>
          <div className="bg-[#0e0e0e] rounded-xl p-3.5 border border-[#1e1e1e]">
            <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Popularity</p>
            <div className="flex items-end gap-1.5">
              <p className="text-xl font-bold text-white">{artist.popularity}</p>
              <p className="text-xs text-zinc-500 mb-0.5">/100</p>
            </div>
          </div>
        </div>

        {/* Popularity bar */}
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
            <span>Spotify Popularity</span>
            <span>{artist.popularity}/100</span>
          </div>
          <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#6366f1] to-[#818cf8] rounded-full transition-all duration-1000"
              style={{ width: `${artist.popularity}%` }}
            />
          </div>
          <p className="text-xs text-zinc-600 mt-1.5">
            {artist.popularity >= 70
              ? "Mainstream ready"
              : artist.popularity >= 50
                ? "Growing momentum"
                : artist.popularity >= 30
                  ? "Building fanbase"
                  : "Early stage artist"}
          </p>
        </div>
      </div>
    </div>
  );
}
