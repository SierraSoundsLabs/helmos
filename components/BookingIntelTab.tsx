"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import type { ArtistData } from "@/lib/spotify";
import type { EnrichedVenue, VenueHit } from "@/lib/booking-intel";

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

  const runScan = async () => {
    if (!isPaid) {
      onSubscribe();
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
        body: JSON.stringify({ artistData: artist, targetCity: targetCity.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");

      setVenues(data.venues.map((v: VenueHit) => ({ ...v, contacts: [] })));
    } catch (e: any) {
      setError(e.message || "Something went wrong scanning venues");
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

  const generateDrafts = () => {
    // In a real implementation this would call the existing outreach system
    alert("Prototype: Would generate beautiful pitch drafts using the existing Helmos outreach engine and push them to your Outreach tab. (Fully wired in production version)");
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Hero Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-3xl">🎯</div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Booking Intel</h1>
            <p className="text-zinc-400">Real venues that have booked artists like you. Real buyers, not guesses.</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 text-[11px] px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
          POWERED BY LIVE DATA • BANDSINTOWN + HUNTER
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={targetCity}
          onChange={(e) => setTargetCity(e.target.value)}
          placeholder="Target city (optional, e.g. Austin, Berlin)"
          className="flex-1 min-w-[260px] bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-3 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-[#6366f1]/50"
        />
        <button
          onClick={runScan}
          disabled={loading}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-black font-semibold text-sm hover:brightness-110 active:scale-[0.985] transition-all disabled:opacity-60 flex items-center gap-2"
        >
          {loading ? "Scanning real tour history..." : "Scan Similar Artists' Venues"}
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
              LIVE MAP • {venues.length} REAL VENUES
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
                      <div className="text-sm text-zinc-400">{v.city}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] px-2 py-px rounded bg-teal-500/15 text-teal-400 font-mono">{v.matchScore}%</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[12px] text-emerald-400">
                    Last booked <span className="text-white/80">{v.lastBookedSimilarArtist}</span> • {new Date(v.lastBookedDate).toLocaleDateString()}
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
                  <div className="text-zinc-400">{selectedVenue.city}</div>
                </div>
                <button
                  onClick={generateDrafts}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-white text-black hover:bg-zinc-200 active:bg-white transition-colors"
                >
                  Generate Pitch Drafts →
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Real Context */}
                <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
                  <div className="uppercase tracking-[1px] text-[10px] text-zinc-500 mb-3">WHY THIS MATCHES YOU</div>
                  <div className="text-sm leading-relaxed">
                    {selectedVenue.lastBookedSimilarArtist} played here on {new Date(selectedVenue.lastBookedDate).toLocaleDateString()}. 
                    Strong {selectedVenue.matchScore}% similarity to your current draw and genre.
                  </div>
                </div>

                {/* Contacts */}
                <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="uppercase tracking-[1px] text-[10px] text-zinc-500">TALENT BUYERS & BOOKING CONTACTS</div>
                    {!selectedVenue.contacts?.length && !selectedVenue.contactsError && (
                      <button
                        onClick={() => discoverContacts(selectedVenue)}
                        disabled={enriching}
                        className="text-xs px-3 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 transition-colors"
                      >
                        {enriching ? "Looking up..." : "Discover Contacts"}
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
                    !selectedVenue.contactsError && <div className="text-sm text-zinc-500">Click “Discover Contacts” to run live Hunter lookup for this venue.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {venues.length === 0 && !loading && (
        <div className="text-center py-16 text-zinc-500 text-sm">
          Run a scan to see real venues that have booked artists in your lane.<br />
          We pull actual tour history instead of making things up.
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-3 text-zinc-400">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            Pulling real tour history from similar artists...
          </div>
        </div>
      )}
    </div>
  );
}
