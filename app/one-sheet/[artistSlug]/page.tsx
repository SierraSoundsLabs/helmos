export const dynamic = "force-dynamic";

import { kvGet } from "@/lib/kv";
import type { OneSheetData } from "@/lib/types";
import { formatNumber } from "@/lib/spotify";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

interface Props {
  params: Promise<{ artistSlug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { artistSlug } = await params;
  const data = await kvGet<OneSheetData>(`onesheet:${artistSlug}`);
  if (!data) return { title: "Artist Not Found" };
  return {
    title: `${data.artistName} — One-Sheet`,
    description: data.bio?.slice(0, 160) || `${data.artistName} artist one-sheet`,
  };
}

export default async function OneSheetPage({ params }: Props) {
  const { artistSlug } = await params;
  const data = await kvGet<OneSheetData>(`onesheet:${artistSlug}`);
  if (!data) notFound();

  const genre = data.genres[0] ?? "Independent";
  const secondGenre = data.genres[1];
  const genreDisplay = secondGenre ? `${genre} · ${secondGenre}` : genre;

  const hasPressQuotes = data.pressQuotes && data.pressQuotes.length > 0;

  return (
    <>
      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>

      {/* Print styles injected globally */}
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: 'Inter', system-ui, sans-serif; background: #fff; margin: 0; }

        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff; }
          @page { size: A4 portrait; margin: 0.5in; }
          .page-root { box-shadow: none !important; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>

      {/* Download button — hidden in print */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <PrintButton />
      </div>

      {/* One-sheet page */}
      <div
        className="page-root"
        style={{
          maxWidth: "794px",         /* ~A4 width at 96dpi */
          minHeight: "1123px",       /* ~A4 height at 96dpi */
          margin: "40px auto",
          background: "#fff",
          padding: "48px 52px",
          boxShadow: "0 4px 40px rgba(0,0,0,0.12)",
          fontFamily: "'Inter', system-ui, sans-serif",
          color: "#111",
        }}
      >
        {/* ── Header bar ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          {/* Helm logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "22px", height: "22px", borderRadius: "6px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#fff" }}>H</span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#8b5cf6", letterSpacing: "0.05em" }}>HELM</span>
          </div>
          <span style={{ fontSize: "10px", color: "#999", letterSpacing: "0.05em" }}>helmos.co</span>
        </div>

        {/* ── Top section: photo + name + stats ───────────────────────── */}
        <div style={{ display: "flex", gap: "28px", alignItems: "flex-start", marginBottom: "32px" }}>
          {/* Artist photo */}
          <div style={{ flexShrink: 0 }}>
            {data.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.photoUrl}
                alt={data.artistName}
                style={{
                  width: "160px", height: "160px",
                  borderRadius: "12px",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div style={{
                width: "160px", height: "160px", borderRadius: "12px",
                background: "linear-gradient(135deg, #e0e7ff, #ede9fe)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "52px",
              }}>
                🎵
              </div>
            )}
          </div>

          {/* Name + genre + stats */}
          <div style={{ flex: 1, paddingTop: "4px" }}>
            <div style={{ fontSize: "10px", fontWeight: 600, color: "#8b5cf6", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>
              Artist One-Sheet
            </div>
            <h1 style={{
              fontSize: "32px", fontWeight: 900, lineHeight: 1.1,
              textTransform: "uppercase", letterSpacing: "-0.01em",
              color: "#0a0a0a", margin: "0 0 6px",
            }}>
              {data.artistName}
            </h1>
            <p style={{ fontSize: "12px", color: "#666", margin: "0 0 20px", fontWeight: 500 }}>
              {genreDisplay}
              {data.location ? ` · ${data.location}` : ""}
            </p>

            {/* Stats row */}
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {data.monthlyListeners > 0 && (
                <StatBlock
                  value={formatNumber(data.monthlyListeners)}
                  label="Monthly Listeners"
                  accent
                />
              )}
              {(data.spotifyFollowers ?? 0) > 0 && (
                <StatBlock
                  value={formatNumber(data.spotifyFollowers!)}
                  label="Spotify Followers"
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <Divider />

        {/* ── Bio ─────────────────────────────────────────────────────── */}
        {data.bio && (
          <Section title="About">
            <p style={{
              fontSize: "12px", lineHeight: 1.7, color: "#333",
              margin: 0,
            }}>
              {data.bio}
            </p>
          </Section>
        )}

        {/* ── Top Tracks ───────────────────────────────────────────────── */}
        {data.topTracks.length > 0 && (
          <Section title="Top Tracks">
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {data.topTracks.map((track, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "7px 10px", borderRadius: "7px",
                  background: i % 2 === 0 ? "#fafafa" : "#fff",
                  border: "1px solid #f0f0f0",
                }}>
                  <span style={{ fontSize: "10px", color: "#bbb", fontWeight: 600, minWidth: "16px" }}>{i + 1}.</span>
                  {track.albumArt && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={track.albumArt}
                      alt=""
                      style={{ width: "28px", height: "28px", borderRadius: "4px", objectFit: "cover", flexShrink: 0 }}
                    />
                  )}
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "#111", flex: 1 }}>{track.name}</span>
                  {track.streams && (
                    <span style={{ fontSize: "10px", color: "#999", fontWeight: 500 }}>
                      {formatNumber(track.streams)} streams
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Press Highlights ─────────────────────────────────────────── */}
        {hasPressQuotes && (
          <Section title="Press Highlights">
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {data.pressQuotes!.map((quote, i) => (
                <div key={i} style={{
                  borderLeft: "3px solid #8b5cf6",
                  paddingLeft: "12px",
                  paddingTop: "2px",
                  paddingBottom: "2px",
                }}>
                  <p style={{ fontSize: "12px", color: "#444", fontStyle: "italic", margin: 0, lineHeight: 1.6 }}>
                    &ldquo;{quote}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Connect ──────────────────────────────────────────────────── */}
        {Object.values(data.socialLinks).some(Boolean) && (
          <Section title="Connect">
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
              {data.socialLinks.spotify && (
                <SocialLink href={data.socialLinks.spotify} label="Spotify" />
              )}
              {data.socialLinks.instagram && (
                <SocialLink href={data.socialLinks.instagram} label={`@${extractHandle(data.socialLinks.instagram)}`} />
              )}
              {data.socialLinks.tiktok && (
                <SocialLink href={data.socialLinks.tiktok} label={`@${extractHandle(data.socialLinks.tiktok)}`} />
              )}
              {data.socialLinks.youtube && (
                <SocialLink href={data.socialLinks.youtube} label="YouTube" />
              )}
              {data.socialLinks.website && (
                <SocialLink href={data.socialLinks.website} label={data.socialLinks.website.replace(/^https?:\/\//, "")} />
              )}
            </div>
          </Section>
        )}

        {/* ── Booking & Press ──────────────────────────────────────────── */}
        {data.bookingEmail && (
          <Section title="Booking & Press">
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center" }}>
              <a href={`mailto:${data.bookingEmail}`} style={{ fontSize: "12px", color: "#8b5cf6", fontWeight: 600 }}>
                {data.bookingEmail}
              </a>
              {data.socialLinks.website && (
                <a href={data.socialLinks.website} style={{ fontSize: "12px", color: "#8b5cf6" }}>
                  {data.socialLinks.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </Section>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{
          marginTop: "auto",
          paddingTop: "20px",
          borderTop: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: "9px", color: "#ccc" }}>
            Generated via Helm · helmos.co
          </span>
          <span style={{ fontSize: "9px", color: "#ccc" }}>
            {new Date(data.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Screen-only bottom padding */}
      <div className="no-print" style={{ height: "60px" }} />
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Divider() {
  return (
    <div style={{
      height: "2px",
      background: "linear-gradient(90deg, #8b5cf6 0%, #e8e2ff 60%, transparent 100%)",
      marginBottom: "24px",
      borderRadius: "2px",
    }} />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
        <span style={{
          fontSize: "9px", fontWeight: 700, letterSpacing: "0.15em",
          textTransform: "uppercase", color: "#8b5cf6",
        }}>
          {title}
        </span>
        <div style={{ flex: 1, height: "1px", background: "#e8e2ff" }} />
      </div>
      {children}
    </div>
  );
}

function StatBlock({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? "#faf5ff" : "#f8f8f8",
      border: `1px solid ${accent ? "#e9d5ff" : "#eee"}`,
      borderRadius: "8px",
      padding: "10px 14px",
      minWidth: "100px",
    }}>
      <div style={{
        fontSize: "22px", fontWeight: 800, color: accent ? "#7c3aed" : "#111",
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: "9px", fontWeight: 600, color: "#999", marginTop: "3px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </div>
    </div>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontSize: "11px", color: "#555", fontWeight: 500,
        borderBottom: "1px solid #ddd", paddingBottom: "1px",
        textDecoration: "none",
      }}
    >
      {label}
    </a>
  );
}

function extractHandle(url: string): string {
  // Extract @handle from instagram.com/@handle or tiktok.com/@handle
  const match = url.match(/@([^/?&#]+)/);
  if (match) return match[1];
  // Fall back to last path segment
  const parts = url.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] ?? url;
}
