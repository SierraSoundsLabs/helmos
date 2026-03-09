"use client";

import type { ActionItem } from "@/lib/claude";

export default function ActionItems({ items }: { items: ActionItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div
          key={i}
          className={`relative p-4 rounded-xl border transition-all ${
            item.urgency === "high"
              ? "bg-[#0e0e0e] border-[#6366f1]/40 shadow-[0_0_20px_rgba(99,102,241,0.08)]"
              : "bg-[#0e0e0e] border-[#1e1e1e]"
          }`}
        >
          {/* High urgency accent line */}
          {item.urgency === "high" && (
            <div className="absolute left-0 top-4 bottom-4 w-0.5 bg-gradient-to-b from-[#6366f1] to-[#818cf8] rounded-full" />
          )}

          <div className="flex items-start gap-3">
            {/* Icon */}
            <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                {item.urgency === "high" && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-[#6366f1]/20 text-[#a5b4fc] border border-[#6366f1]/30">
                    urgent
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{item.description}</p>

              {/* Helmos badge */}
              <div className="flex items-center gap-1.5 mt-2.5">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-white">H</span>
                </div>
                <span className="text-xs text-[#6366f1] font-medium">Helmos can do this</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
