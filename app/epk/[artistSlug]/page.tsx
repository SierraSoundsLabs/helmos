import type { Metadata } from "next";
import type { EPKData } from "@/app/api/helm/epk/route";

interface PageProps {
  params: Promise<{ artistSlug: string }>;
}

async function getEPK(slug: string): Promise<EPKData | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const res = await fetch(`${baseUrl}/api/helm/epk?slug=${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<EPKData>;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { artistSlug } = await params;
  const epk = await getEPK(artistSlug);
  if (!epk) return { title: "Artist EPK" };
  return {
    title: `${epk.artistName} — Electronic Press Kit`,
    description: epk.shortBio,
    openGraph: {
      title: `${epk.artistName} — EPK`,
      description: epk.shortBio,
      images: epk.photoUrl ? [epk.photoUrl] : [],
    },
  };
}

export default async function EPKPage({ params }: PageProps) {
  const { artistSlug } = await params;
  const epk = await getEPK(artistSlug);

  if (!epk) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">EPK Not Found</h1>
          <p className="text-zinc-400">This press kit doesn&apos;t exist or hasn&apos;t been published yet.</p>
        </div>
      </div>
    );
  }

  const genreStr = epk.genres.slice(0, 3).join(" · ");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 print:bg-white print:text-black">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12pt; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row gap-8 mb-12 pb-12 border-b border-zinc-800 print:border-zinc-300">
          {epk.photoUrl && (
            <div className="flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={epk.photoUrl}
                alt={epk.artistName}
                className="w-48 h-48 object-cover rounded-lg"
              />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">{epk.artistName}</h1>
            {genreStr && (
              <p className="text-emerald-400 text-sm font-medium mb-4 print:text-emerald-700">{genreStr}</p>
            )}

            {/* Stats Row */}
            <div className="flex flex-wrap gap-6 mb-6">
              <div>
                <div className="text-2xl font-bold text-white">{epk.monthlyListenersFormatted}</div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider">Monthly Listeners</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{epk.spotifyFollowersFormatted}</div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider">Spotify Followers</div>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex flex-wrap gap-3">
              {epk.spotifyUrl && (
                <a
                  href={epk.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors no-print"
                >
                  Spotify
                </a>
              )}
              {epk.socialLinks.instagram && (
                <a
                  href={epk.socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors no-print"
                >
                  Instagram
                </a>
              )}
              {epk.socialLinks.tiktok && (
                <a
                  href={epk.socialLinks.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors no-print"
                >
                  TikTok
                </a>
              )}
              {epk.socialLinks.youtube && (
                <a
                  href={epk.socialLinks.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors no-print"
                >
                  YouTube
                </a>
              )}
              {epk.socialLinks.website && (
                <a
                  href={epk.socialLinks.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors no-print"
                >
                  Website
                </a>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-10">
            {/* Short Bio */}
            <section>
              <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Short Bio</h2>
              <p className="text-zinc-200 leading-relaxed">{epk.shortBio}</p>
            </section>

            {/* Long Bio */}
            <section>
              <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Biography</h2>
              <div className="space-y-4">
                {epk.longBio.split("\n\n").map((para, i) => (
                  <p key={i} className="text-zinc-300 leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            </section>

            {/* Artist Statement */}
            <section>
              <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Artist Statement</h2>
              <blockquote className="border-l-2 border-emerald-500 pl-4 text-zinc-300 italic leading-relaxed print:border-emerald-700">
                {epk.artistStatement}
              </blockquote>
            </section>

            {/* Press Quotes */}
            {epk.pressQuotes.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Press</h2>
                <div className="space-y-4">
                  {epk.pressQuotes.map((quote, i) => (
                    <div
                      key={i}
                      className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 print:border-zinc-300"
                    >
                      <p className="text-zinc-300 italic">&ldquo;{quote}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Top Tracks */}
            {epk.topTracks.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Top Tracks</h2>
                <div className="space-y-3">
                  {epk.topTracks.map((track) => (
                    <a
                      key={track.id}
                      href={track.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 group no-print"
                    >
                      {track.albumArt && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={track.albumArt}
                          alt={track.name}
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                        {track.name}
                      </span>
                    </a>
                  ))}
                  {/* Print-only track list */}
                  <div className="hidden print:block">
                    {epk.topTracks.map((track) => (
                      <div key={track.id} className="py-1 text-sm">
                        {track.name}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Latest Release */}
            {epk.latestRelease && (
              <section>
                <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Latest Release</h2>
                <a
                  href={epk.latestRelease.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group no-print"
                >
                  {epk.latestRelease.albumArt && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={epk.latestRelease.albumArt}
                      alt={epk.latestRelease.name}
                      className="w-full aspect-square object-cover rounded-lg mb-2"
                    />
                  )}
                  <div className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                    {epk.latestRelease.name}
                  </div>
                  <div className="text-xs text-zinc-500">{epk.latestRelease.releaseDate}</div>
                </a>
                <div className="hidden print:block">
                  <div className="font-medium">{epk.latestRelease.name}</div>
                  <div className="text-sm text-zinc-500">{epk.latestRelease.releaseDate}</div>
                </div>
              </section>
            )}

            {/* Download / Print */}
            <section className="no-print">
              <button
                onClick={() => window.print()}
                className="w-full text-center text-xs px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Print / Save as PDF
              </button>
            </section>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-zinc-800 print:border-zinc-300">
          <p className="text-xs text-zinc-600 print:text-zinc-400">
            Press kit generated by{" "}
            <a href="https://helmos.co" className="hover:text-zinc-400 transition-colors no-print">
              Helmos
            </a>
            <span className="hidden print:inline">Helmos</span>
            {" "}· Updated{" "}
            {new Date(epk.updatedAt).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </footer>
      </div>
    </div>
  );
}
