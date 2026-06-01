"use client";

import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { EnrichedVenue } from "@/lib/booking-intel";

// Fix default marker icons for Leaflet in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface BookingMapProps {
  venues: EnrichedVenue[];
  onVenueSelect?: (venue: EnrichedVenue) => void;
  selectedVenueId?: string;
}

export default function BookingMap({ venues, onVenueSelect, selectedVenueId }: BookingMapProps) {
  const validVenues = venues.filter(v => v.latitude && v.longitude);

  if (validVenues.length === 0) {
    return (
      <div className="h-[420px] bg-[#0a0a0a] border border-[#1e1e1e] rounded-2xl flex items-center justify-center text-zinc-500">
        No mappable venues yet. Run a scan.
      </div>
    );
  }

  // Center on first venue or average
  const centerLat = validVenues.reduce((sum, v) => sum + (v.latitude || 0), 0) / validVenues.length;
  const centerLng = validVenues.reduce((sum, v) => sum + (v.longitude || 0), 0) / validVenues.length;

  return (
    <div className="h-[420px] rounded-2xl overflow-hidden border border-[#1e1e1e] shadow-inner">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={4}
        className="h-full w-full bg-[#111]"
        style={{ background: "#0a0a0a" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validVenues.map((venue, idx) => {
          const isSelected = selectedVenueId === `${venue.venueName}-${idx}`;
          return (
            <Marker
              key={`${venue.venueName}-${idx}`}
              position={[venue.latitude!, venue.longitude!]}
              eventHandlers={{
                click: () => onVenueSelect?.(venue),
              }}
            >
              <Popup className="booking-popup">
                <div className="text-sm">
                  <div className="font-semibold text-white">{venue.venueName}</div>
                  <div className="text-zinc-400">{venue.city}</div>
                  <div className="mt-1 text-[11px] text-emerald-400">
                    Last booked {venue.lastBookedSimilarArtist} • {new Date(venue.lastBookedDate).toLocaleDateString()}
                  </div>
                  <div className="mt-1">
                    <span className="inline-block px-2 py-0.5 text-[10px] rounded bg-teal-500/20 text-teal-400">
                      {venue.matchScore}% match
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
