import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encodeSession, COOKIE_NAME, TTL } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { sessionId, artistId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  // Fetch session from Stripe
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=customer`,
    { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }
  );

  const session = await res.json();
  if (!res.ok) return NextResponse.json({ error: "Session not found" }, { status: 400 });
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return NextResponse.json({ error: "Payment not confirmed", status: session.payment_status }, { status: 402 });
  }

  const email = session.customer_details?.email || session.customer_email || "artist@helmos.co";
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id || "";
  const verifiedArtistId = session.metadata?.artist_id || artistId || "";

  const token = encodeSession({ email, artistId: verifiedArtistId, customerId, plan: "pro" });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    maxAge: TTL,
    path: "/",
    sameSite: "lax",
  });

  return NextResponse.json({ ok: true, artistId: verifiedArtistId, email });
}
