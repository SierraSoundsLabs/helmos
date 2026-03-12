import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  let tokenStatus = "not attempted";
  let spotifyError = "";
  
  if (clientId && clientSecret) {
    try {
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Basic ${creds}` },
        body: "grant_type=client_credentials",
      });
      const data = await res.json();
      tokenStatus = res.ok ? "success" : `failed ${res.status}: ${JSON.stringify(data)}`;
    } catch(e) { spotifyError = String(e); tokenStatus = "fetch_error"; }
  }

  // Test actual artist lookup
  let artistTest = "not attempted";
  if (tokenStatus === "success") {
    try {
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Basic ${creds}` },
        body: "grant_type=client_credentials",
      });
      const tokenData = await tokenRes.json();
      const token = tokenData.access_token;
      
      const artistRes = await fetch("https://api.spotify.com/v1/artists/4q3ewBCX7sLwd24euuV69X", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const artistData = await artistRes.json();
      artistTest = `status:${artistRes.status} name:${artistData.name || 'none'} error:${artistData.error?.message || 'none'}`;
    } catch(e) { artistTest = "error: " + String(e); }
  }

  return NextResponse.json({
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    clientIdPreview: clientId ? clientId.slice(0,6)+"..." : "MISSING",
    tokenStatus, spotifyError, artistTest,
  });
}
