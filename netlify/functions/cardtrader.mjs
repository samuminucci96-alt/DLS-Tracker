import { corsHeaders } from "./_lib/jwt.mjs";

const CT_BASE = "https://api.cardtrader.com/api/v2";
const ALLOWED_PREFIXES = ["/games", "/expansions", "/blueprints", "/marketplace"];

export default async (req) => {
  const cors = corsHeaders;
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Metodo non supportato" }), { status: 405, headers: cors });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "";
  if (!path.startsWith("/") || path.includes("..")) {
    return new Response(JSON.stringify({ error: "Path non valido" }), { status: 400, headers: cors });
  }
  if (!ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return new Response(JSON.stringify({ error: "Path non consentito" }), { status: 403, headers: cors });
  }

  const token = process.env.CARDTRADER_API_TOKEN || process.env.CARDTRADER_API_KEY;
  if (!token) {
    return new Response(JSON.stringify({ error: "Servizio CardTrader non configurato sul server" }), { status: 503, headers: cors });
  }

  const ctRes = await fetch(`${CT_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const body = await ctRes.text();
  return new Response(body, {
    status: ctRes.status,
    headers: {
      ...cors,
      "Content-Type": ctRes.headers.get("Content-Type") || "application/json",
    },
  });
};

export const config = { path: "/api/cardtrader" };
