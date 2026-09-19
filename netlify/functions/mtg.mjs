import { corsHeaders } from "./_lib/jwt.mjs";

const SCRYFALL_BASE = "https://api.scryfall.com";
const MTG_TIMEOUT_MS = Math.max(3000, Number.parseInt(process.env.MTG_TIMEOUT_MS || "12000", 10) || 12000);
const MTG_RETRY_ATTEMPTS = Math.max(0, Number.parseInt(process.env.MTG_RETRY_ATTEMPTS || "1", 10) || 1);
const MTG_RETRY_BASE_DELAY_MS = Math.max(50, Number.parseInt(process.env.MTG_RETRY_DELAY_MS || "180", 10) || 180);
const MTG_CACHE_TTL_MS = Math.max(1000, Number.parseInt(process.env.MTG_CACHE_TTL_MS || "90000", 10) || 90000);
const MTG_CACHE_MAX_ENTRIES = Math.max(10, Number.parseInt(process.env.MTG_CACHE_MAX_ENTRIES || "300", 10) || 300);
const MTG_RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const mtgResponseCache = new Map();
const mtgInflight = new Map();

function getCachedEntry(key) {
  const hit = mtgResponseCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    mtgResponseCache.delete(key);
    return null;
  }
  return hit;
}

function pruneCacheIfNeeded() {
  if (mtgResponseCache.size <= MTG_CACHE_MAX_ENTRIES) return;
  const entries = [...mtgResponseCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  const toDrop = entries.slice(0, Math.max(1, entries.length - MTG_CACHE_MAX_ENTRIES));
  toDrop.forEach(([k]) => mtgResponseCache.delete(k));
}

function setCachedEntry(key, value) {
  mtgResponseCache.set(key, {
    ...value,
    expiresAt: Date.now() + MTG_CACHE_TTL_MS,
  });
  pruneCacheIfNeeded();
}

function isRetryableFetchError(err) {
  if (!err) return false;
  if (err.name === "AbortError") return true;
  const msg = String(err.message || "").toLowerCase();
  return (
    err instanceof TypeError
    || msg.includes("fetch")
    || msg.includes("network")
    || msg.includes("socket")
    || msg.includes("econn")
    || msg.includes("timed out")
  );
}

function validateSetCode(value) {
  return /^[a-z0-9]{2,10}$/i.test(String(value || "").trim());
}

function validateCollectorNumber(value) {
  return /^[a-z0-9\-]{1,24}$/i.test(String(value || "").trim());
}

function validateUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function pickCardImage(card) {
  if (card?.image_uris?.normal) return card.image_uris.normal;
  if (Array.isArray(card?.card_faces)) {
    for (const face of card.card_faces) {
      if (face?.image_uris?.normal) return face.image_uris.normal;
    }
  }
  return "";
}

function normalizeCard(card) {
  if (!card || typeof card !== "object") return null;
  const eur = card?.prices?.eur;
  const eurFoil = card?.prices?.eur_foil;
  return {
    scryfall_id: String(card.id || ""),
    oracle_id: String(card.oracle_id || ""),
    card_name: String(card.name || ""),
    set_code: String(card.set || "").toLowerCase(),
    set_name: String(card.set_name || ""),
    collector_number: String(card.collector_number || ""),
    lang: String(card.lang || "").toLowerCase(),
    image: pickCardImage(card),
    scryfall_uri: String(card.scryfall_uri || ""),
    rarity: String(card.rarity || ""),
    released_at: String(card.released_at || ""),
    is_foil: !!card.foil,
    is_nonfoil: !!card.nonfoil,
    price_eur: eur != null && eur !== "" ? Number(eur) : null,
    price_eur_foil: eurFoil != null && eurFoil !== "" ? Number(eurFoil) : null,
    fetched_at: new Date().toISOString(),
  };
}

async function retryBackoff(attempt) {
  await new Promise((resolve) => setTimeout(resolve, MTG_RETRY_BASE_DELAY_MS * attempt));
}

async function scryfallFetchWithRetry(url) {
  const maxAttempts = 1 + MTG_RETRY_ATTEMPTS;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), MTG_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DLS-Tracker/1.0" },
        signal: ctrl.signal,
      });
      const contentType = res.headers.get("Content-Type") || "application/json";
      const body = await res.text();

      if (MTG_RETRYABLE_STATUS.has(res.status) && attempt < maxAttempts) {
        await retryBackoff(attempt);
        continue;
      }
      return { status: res.status, body, contentType };
    } catch (err) {
      lastError = err;
      if (!isRetryableFetchError(err) || attempt >= maxAttempts) {
        return { error: err };
      }
      await retryBackoff(attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  return { error: lastError || new Error("Errore upstream sconosciuto") };
}

function parseJsonBody(rawBody) {
  try {
    return JSON.parse(rawBody || "{}");
  } catch {
    return null;
  }
}

function buildScryfallUrl(mode, params) {
  if (mode === "exact") {
    const set = String(params.get("set") || "").trim().toLowerCase();
    const number = String(params.get("number") || "").trim();
    if (!validateSetCode(set) || !validateCollectorNumber(number)) return null;
    return `${SCRYFALL_BASE}/cards/${encodeURIComponent(set)}/${encodeURIComponent(number)}`;
  }

  if (mode === "autocomplete") {
    const q = String(params.get("q") || "").trim();
    if (!q || q.length > 120) return null;
    return `${SCRYFALL_BASE}/cards/autocomplete?q=${encodeURIComponent(q)}`;
  }

  if (mode === "editions") {
    const exact = String(params.get("exact") || "").trim();
    if (!exact || exact.length > 140) return null;
    const lang = String(params.get("lang") || "").trim().toLowerCase();
    const langFilter = /^[a-z]{2,3}$/.test(lang) ? ` lang:${lang}` : "";
    const query = `!\"${exact.replace(/\"/g, "")}\"${langFilter}`;
    return `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(query)}&unique=prints&order=released&dir=desc`;
  }

  if (mode === "id") {
    const id = String(params.get("id") || "").trim();
    if (!validateUuid(id)) return null;
    return `${SCRYFALL_BASE}/cards/${encodeURIComponent(id)}`;
  }

  return null;
}

function adaptResponse(mode, payload) {
  if (mode === "autocomplete") {
    return {
      data: Array.isArray(payload?.data) ? payload.data : [],
      has_more: !!payload?.has_more,
      fetched_at: new Date().toISOString(),
    };
  }

  if (mode === "exact" || mode === "id") {
    return { data: normalizeCard(payload) };
  }

  if (mode === "editions") {
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    return { data: rows.map(normalizeCard).filter(Boolean) };
  }

  return { data: payload };
}

export default async (req) => {
  const cors = corsHeaders;
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Metodo non supportato" }), { status: 405, headers: cors });
  }

  const url = new URL(req.url);
  const mode = String(url.searchParams.get("mode") || "").trim().toLowerCase();
  if (!["exact", "autocomplete", "editions", "id"].includes(mode)) {
    return new Response(JSON.stringify({ error: "Mode non valido" }), { status: 400, headers: cors });
  }

  const scryfallUrl = buildScryfallUrl(mode, url.searchParams);
  if (!scryfallUrl) {
    return new Response(JSON.stringify({ error: "Parametri query non validi" }), { status: 400, headers: cors });
  }

  const cacheKey = `${mode}|${scryfallUrl}`;
  const cached = getCachedEntry(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: {
        ...cors,
        "Content-Type": cached.contentType || "application/json",
        "X-DLS-Cache": "HIT",
      },
    });
  }

  if (!mtgInflight.has(cacheKey)) {
    mtgInflight.set(cacheKey, scryfallFetchWithRetry(scryfallUrl));
  }

  let result;
  try {
    result = await mtgInflight.get(cacheKey);
  } finally {
    mtgInflight.delete(cacheKey);
  }

  if (result?.error) {
    const isAbort = result.error?.name === "AbortError";
    return new Response(
      JSON.stringify({
        error: isAbort ? "Timeout verso Scryfall" : "Errore connessione verso Scryfall",
        detail: isAbort ? `Scaduto dopo ${MTG_TIMEOUT_MS}ms` : (result.error?.message || "Errore sconosciuto"),
      }),
      { status: isAbort ? 504 : 502, headers: cors },
    );
  }

  const status = Number(result?.status || 500);
  const contentType = result?.contentType || "application/json";
  const upstreamPayload = parseJsonBody(result?.body);

  if (status >= 400) {
    const upstreamError = upstreamPayload?.details || upstreamPayload?.error || `Errore Scryfall (${status})`;
    return new Response(JSON.stringify({ error: String(upstreamError) }), {
      status,
      headers: {
        ...cors,
        "X-DLS-Cache": "MISS",
      },
    });
  }

  const payload = adaptResponse(mode, upstreamPayload);
  const body = JSON.stringify(payload);

  if (status >= 200 && status < 300) {
    setCachedEntry(cacheKey, { status, contentType: "application/json", body });
  }

  return new Response(body, {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "X-DLS-Cache": "MISS",
    },
  });
};

export const config = { path: "/api/mtg" };
