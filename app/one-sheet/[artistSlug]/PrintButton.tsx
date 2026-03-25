"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 16px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        color: "#fff",
        background: "#8b5cf6",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 2px 12px rgba(139,92,246,0.35)",
      }}
    >
      ↓ Download PDF
    </button>
  );
}
