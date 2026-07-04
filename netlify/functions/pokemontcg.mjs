import { corsHeaders } from "./_lib/jwt.mjs";

const PT_BASE = "https://api.pokemontcg.io/v2/cards";

export default async (req) => {
  const cors = corsHeaders;
  if (req.method === "OPTIONS") return new Response("", { headers: cors });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Metodo non supportato" }), { status: 405, headers: cors });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q || q.length > 500) {
    return new Response(JSON.stringify({ error: "Query non valida" }), { status: 400, headers: cors });
  }

  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20));
  const apiKey = process.env.POKEMON_TCG_API_KEY || "";
  const ptUrl = `${PT_BASE}?q=${encodeURIComponent(q)}&pageSize=${pageSize}`;
  const headers = { Accept: "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;

  const ptRes = await fetch(ptUrl, { headers });
  const body = await ptRes.text();
  return new Response(body, {
    status: ptRes.status,
    headers: {
      ...cors,
      "Content-Type": ptRes.headers.get("Content-Type") || "application/json",
    },
  });
};

export const config = { path: "/api/pokemontcg" };
