"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import type { ArtistData } from "@/lib/spotify";
import type { EnrichedVenue, VenueHit } from "@/lib/booking-intel";
import type { OutreachDraft } from "@/app/api/helm/outreach/generate/route";

// Leaflet (used inside BookingMap) accesses `window` at module load, which
// crashes Next.js' static prerender of /dashboard. Load the map only on the
// client to keep the rest of the dashboard SSR/prerender-safe.
const BookingMap = dynamic(() => import("./BookingMap"), { ssr: false });

interface BookingIntelTabProps {
  artist: ArtistData;
  isPaid: boolean;
  onSubscribe: () => void;
}

export default function BookingIntelTab({ artist, isPaid, onSubscribe }: BookingIntelTabProps) {
  const [targetCity, setTargetCity] = useState("");
  const [venues, setVenues] = useState<EnrichedVenue[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<EnrichedVenue | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drafts modal state — populated when the user hits "Generate Pitch Drafts"
  // on a selected venue. Drafts are sent via the existing outreach send API
  // so daily-limit + deliverability gating are enforced consistently.
  const [drafts, setDrafts] = useState<OutreachDraft[] | null>(null);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentSummary, setSentSummary] = useState<string | null>(null);

  const runScan = async () => {
    if (!isPaid) {
      onSubscribe();
      return;
    }
    if (!targetCity.trim()) {
      setError("Enter a city — I need to know where to look for venues.");
      return;
    }
    setLoading(true);
    setError(null);
    setVenues([]);
    setSelectedVenue(null);

    try {
      const res = await fetch("/api/helm/booking-intel/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistData: artist, targetCity: targetCity.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");

      setVenues(data.venues.map((v: VenueHit) => ({ ...v, contacts: [] })));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong scanning venues";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const discoverContacts = async (venue: EnrichedVenue) => {
    setEnriching(true);
    try {
      const res = await fetch("/api/helm/booking-intel/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venues: [venue] }),
      });
      const data = await res.json();
      if (data.enriched?.[0]) {
        const updated = venues.map(v =>
          v.venueName === venue.venueName && v.city === venue.city
            ? data.enriched[0]
            : v
        );
        setVenues(updated);
        setSelectedVenue(data.enriched[0]);
      }
    } catch (e) {
      console.error("Contact discovery failed", e);
    } finally {
      setEnriching(false);
    }
  };

  const handleSelectVenue = (venue: EnrichedVenue) => {
    setSelectedVenue(venue);
    if (venue.contacts.length === 0 && !venue.contactsError) {
      discoverContacts(venue);
    }
  };

  const generateDrafts = async () => {
    if (!selectedVenue) return;
    if (!selectedVenue.contacts.length) {
      setDraftsError("No contacts to pitch — click Discover Contacts first.");
      return;
    }
    setDraftsLoading(true);
    setDraftsError(null);
    setSentSummary(null);
    try {
      const res = await fetch("/api/helm/booking-intel/generate-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistData: artist,
          venue: selectedVenue,
          contacts: selectedVenue.contacts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Draft generation failed");
      if (!Array.isArray(data.drafts) || data.drafts.length === 0) {
        throw new Error("No drafts came back");
      }
      setDrafts(data.drafts);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Draft generation failed";
      setDraftsError(msg);
    } finally {
      setDraftsLoading(false);
    }
  };

  const sendDrafts = async () => {
    if (!drafts || drafts.length === 0) return;
    setSending(true);
    setDraftsError(null);
    try {
      const res = await fetch("/api/helm/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId: artist.id,
          artistName: artist.name,
          drafts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      const parts = [`${data.sent ?? 0} sent`];
      if (data.failed) parts.push(`${data.failed} failed`);
      if (data.skipped) parts.push(`${data.skipped} skipped (undeliverable)`);
      setSentSummary(parts.join(" · "));
      setDrafts(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Send failed";
      setDraftsError(msg);
    } finally {
      setSending(false);
    }
  };

  const updateDraft = (idx: number, patch: Partial<OutreachDraft>) => {
    if (!drafts) return;
    setDrafts(drafts.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Hero Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-3xl">🎯</div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Booking Intel</h1>
            <p className="text-zinc-400">Real venues in your target city that fit your draw — with talent buyers surfaced via Hunter.</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 text-[11px] px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
          AI VENUE SCOUT · HUNTER CONTACTS
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={targetCity}
          onChange={(e) => setTargetCity(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") runScan(); }}
          placeholder="Target city (required — e.g. Austin, Berlin, Los Angeles)"
          className="flex-1 min-w-[260px] bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-3 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-[#6366f1]/50"
        />
        <button
          onClick={runScan}
          disabled={loading}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-black font-semibold text-sm hover:brightness-110 active:scale-[0.985] transition-all disabled:opacity-60 flex items-center gap-2"
        >
          {loading ? "Scanning venues…" : "Scan Venues"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/40 border border-red-900/50 text-red-400 rounded-xl text-sm">{error}</div>
      )}

      {/* Results */}
      {venues.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Map */}
          <div className="lg:col-span-3">
            <div className="text-xs font-medium text-zinc-400 mb-2 px-1 flex items-center gap-2">
              {venues.length} VENUE{venues.length === 1 ? "" : "S"} FOUND IN {targetCity.toUpperCase()}
            </div>
            <BookingMap
              venues={venues}
              onVenueSelect={handleSelectVenue}
              selectedVenueId={selectedVenue ? `${selectedVenue.venueName}-0` : undefined}
            />
          </div>

          {/* Venue List */}
          <div className="lg:col-span-2">
            <div className="text-xs font-medium text-zinc-400 mb-2 px-1">TOP MATCHES</div>
            <div className="space-y-2 max-h-[420px] overflow-auto pr-1 custom-scroll">
              {venues.slice(0, 12).map((v, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectVenue(v)}
                  className={`group p-4 rounded-2xl border cursor-pointer transition-all ${
                    selectedVenue?.venueName === v.venueName
                      ? "bg-[#111] border-teal-500/60"
                      : "bg-[#0a0a0a] border-[#1e1e1e] hover:border-[#333] hover:bg-[#111]"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-white group-hover:text-teal-400 transition-colors">{v.venueName}</div>
                      <div className="text-sm text-zinc-400">
                        {v.neighborhood ? `${v.neighborhood} · ` : ""}{v.city}
                        {v.capacity ? ` · ~${v.capacity} cap` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] px-2 py-px rounded bg-teal-500/15 text-teal-400 font-mono">{v.matchScore}%</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[12px] text-zinc-300 leading-snug">
                    {v.whyMatch}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Venue Detail + Contacts */}
          {selectedVenue && (
            <div className="lg:col-span-5 mt-4 border-t border-[#1e1e1e] pt-8">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-2xl font-semibold">{selectedVenue.venueName}</div>
                  <div className="text-zinc-400">
                    {selectedVenue.neighborhood ? `${selectedVenue.neighborhood} · ` : ""}{selectedVenue.city}
                    {selectedVenue.capacity ? ` · ~${selectedVenue.capacity} cap` : ""}
                  </div>
                </div>
                <button
                  onClick={generateDrafts}
                  disabled={draftsLoading || !selectedVenue.contacts.length}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-white text-black hover:bg-zinc-200 active:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!selectedVenue.contacts.length ? "Discover contacts first" : undefined}
                >
                  {draftsLoading ? "Drafting…" : "Generate Pitch Drafts →"}
                </button>
              </div>

              {sentSummary && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                  ✅ {sentSummary}. Check your Outreach tab for status.
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {/* Real Context */}
                <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
                  <div className="uppercase tracking-[1px] text-[10px] text-zinc-500 mb-3">WHY THIS MATCHES YOU</div>
                  <div className="text-sm leading-relaxed">
                    {selectedVenue.whyMatch}
                  </div>
                </div>

                {/* Contacts */}
                <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="uppercase tracking-[1px] text-[10px] text-zinc-500">TALENT BUYERS &amp; BOOKING CONTACTS</div>
                    {!selectedVenue.contacts?.length && !selectedVenue.contactsError && (
                      <button
                        onClick={() => discoverContacts(selectedVenue)}
                        disabled={enriching}
                        className="text-xs px-3 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 transition-colors"
                      >
                        {enriching ? "Looking up…" : "Discover Contacts"}
                      </button>
                    )}
                  </div>

                  {selectedVenue.contactsError && (
                    <div className="text-sm text-amber-400">{selectedVenue.contactsError}</div>
                  )}

                  {selectedVenue.contacts && selectedVenue.contacts.length > 0 ? (
                    <div className="space-y-2">
                      {selectedVenue.contacts.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex justify-between text-sm bg-black/40 p-3 rounded-xl">
                          <div>
                            <div className="font-medium text-white">{c.name || c.email}</div>
                            <div className="text-[12px] text-zinc-400">{c.position || "Booking / Talent"}</div>
                          </div>
                          <div className="text-right text-emerald-400 font-mono text-xs pt-1">{c.confidence}%</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !selectedVenue.contactsError && <div className="text-sm text-zinc-500">Click &ldquo;Discover Contacts&rdquo; to run a live Hunter lookup for this venue.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {venues.length === 0 && !loading && (
        <div className="text-center py-16 text-zinc-500 text-sm">
          Enter a target city and scan to see venues that fit your genre and draw.
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-3 text-zinc-400">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            Naming real venues in {targetCity}…
          </div>
        </div>
      )}

      {/* Drafts modal */}
      {drafts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
             onClick={() => { if (!sending) setDrafts(null); }}>
          <div className="w-full max-w-3xl max-h-[90vh] bg-[#0e0e0e] border border-[#2e2e2e] rounded-2xl flex flex-col overflow-hidden"
               onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Review {drafts.length} pitch{drafts.length === 1 ? "" : "es"} · {selectedVenue?.venueName}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Edit any subject or body before sending. Undeliverable addresses skip automatically.</div>
              </div>
              <button
                onClick={() => setDrafts(null)}
                disabled={sending}
                className="text-zinc-500 hover:text-zinc-200 disabled:opacity-40"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-4 custom-scroll">
              {drafts.map((d, i) => (
                <div key={i} className="border border-[#1e1e1e] rounded-xl p-4 bg-[#0a0a0a]">
                  <div className="text-[11px] text-zinc-500 mb-2">TO: {d.toName} &lt;{d.to}&gt; · {d.toRole}</div>
                  <input
                    type="text"
                    value={d.subject}
                    onChange={(e) => updateDraft(i, { subject: e.target.value })}
                    className="w-full bg-transparent border-b border-[#1e1e1e] focus:border-teal-500/50 focus:outline-none text-sm font-semibold text-white pb-1 mb-3"
                    placeholder="Subject"
                  />
                  <textarea
                    value={d.body}
                    onChange={(e) => updateDraft(i, { body: e.target.value })}
                    rows={7}
                    className="w-full bg-transparent text-sm text-zinc-200 leading-relaxed focus:outline-none resize-none"
                    placeholder="Body"
                  />
                </div>
              ))}
            </div>

            {draftsError && (
              <div className="mx-5 mb-3 p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-400 text-xs">{draftsError}</div>
            )}

            <div className="px-5 py-4 border-t border-[#1e1e1e] flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">Sending counts toward your 10/day outreach limit.</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDrafts(null)}
                  disabled={sending}
                  className="px-4 py-2 text-sm rounded-xl border border-[#2e2e2e] text-zinc-300 hover:bg-[#111] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={sendDrafts}
                  disabled={sending}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-teal-500 text-black hover:bg-teal-400 disabled:opacity-50"
                >
                  {sending ? "Sending…" : `Send ${drafts.length} email${drafts.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Draft-error toast — shown when generation itself fails (no modal open) */}
      {draftsError && !drafts && (
        <div className="fixed bottom-6 right-6 max-w-sm p-4 bg-red-950/70 border border-red-900/60 text-red-300 rounded-xl text-sm shadow-lg">
          {draftsError}
          <button
            onClick={() => setDraftsError(null)}
            className="ml-3 text-red-400 hover:text-red-200"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}
    </div>
  );
}
