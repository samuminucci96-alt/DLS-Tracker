import { corsHeaders } from "./_lib/jwt.mjs";

const PT_BASE = "https://api.pokemontcg.io/v2/cards";
const PT_TIMEOUT_MS = Math.max(3000, Number.parseInt(process.env.POKEMON_TCG_TIMEOUT_MS || "12000", 10) || 12000);
const PT_RETRY_ATTEMPTS = Math.max(0, Number.parseInt(process.env.POKEMON_TCG_RETRY_ATTEMPTS || "1", 10) || 1);
const PT_RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const PT_CACHE_TTL_MS = Math.max(1000, Number.parseInt(process.env.POKEMON_TCG_CACHE_TTL_MS || "90000", 10) || 90000);
const PT_CACHE_MAX_ENTRIES = Math.max(10, Number.parseInt(process.env.POKEMON_TCG_CACHE_MAX_ENTRIES || "250", 10) || 250);

const ptResponseCache = new Map();
const ptInflight = new Map();

function getCachedEntry(key) {
  const hit = ptResponseCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    ptResponseCache.delete(key);
    return null;
  }
  return hit;
}

function pruneCacheIfNeeded() {
  if (ptResponseCache.size <= PT_CACHE_MAX_ENTRIES) return;
  const entries = [...ptResponseCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  const toDrop = entries.slice(0, Math.max(1, entries.length - PT_CACHE_MAX_ENTRIES));
  toDrop.forEach(([k]) => ptResponseCache.delete(k));
}

function setCachedEntry(key, value) {
  ptResponseCache.set(key, {
    ...value,
    expiresAt: Date.now() + PT_CACHE_TTL_MS,
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

async function ptFetchWithRetry(ptUrl, headers) {
  const maxAttempts = 1 + PT_RETRY_ATTEMPTS;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PT_TIMEOUT_MS);
    try {
      const res = await fetch(ptUrl, { headers, signal: ctrl.signal });
      const contentType = res.headers.get("Content-Type") || "application/json";
      const body = await res.text();
      
      if (PT_RETRYABLE_STATUS.has(res.status) && attempt < maxAttempts) {
        // Body è già consumato, continua al retry
        continue;
      }
      return { body, status: res.status, contentType, attempts: attempt };
    } catch (err) {
      lastError = err;
      if (!isRetryableFetchError(err) || attempt >= maxAttempts) {
        return { error: err, attempts: attempt };
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return { error: lastError || new Error("Errore upstream sconosciuto"), attempts: maxAttempts };
}

export default async (req) => {
  const cors = corsHeaders;
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Metodo non supportato" }), { status: 405, headers: cors });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q || q.length > 500) {
    return new Response(JSON.stringify({ error: "Query non valida" }), { status: 400, headers: cors });
  }

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(250, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20));
  const apiKey = process.env.POKEMON_TCG_API_KEY || "";
  const ptUrl = `${PT_BASE}?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`;
  const cacheKey = `${q}|p=${page}|ps=${pageSize}`;
  const headers = { Accept: "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;

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

  if (!ptInflight.has(cacheKey)) {
    ptInflight.set(cacheKey, ptFetchWithRetry(ptUrl, headers));
  }

  const { body, status, contentType: resContentType, error } = await ptInflight.get(cacheKey);
  ptInflight.delete(cacheKey);
  
  if (body !== undefined) {
    const contentType = resContentType || "application/json";
    if (status >= 200 && status < 300) {
      setCachedEntry(cacheKey, {
        status,
        contentType,
        body,
      });
    }
    return new Response(body, {
      status,
      headers: {
        ...cors,
        "Content-Type": contentType,
        "X-DLS-Cache": "MISS",
      },
    });
  }

  const isAbort = error?.name === "AbortError";
  return new Response(
    JSON.stringify({
      error: isAbort
        ? "Timeout verso Pokémon TCG API"
        : "Errore di connessione verso Pokémon TCG API",
      detail: isAbort ? `Scaduto dopo ${PT_TIMEOUT_MS}ms` : (error?.message || "Errore sconosciuto"),
    }),
    {
      status: isAbort ? 504 : 502,
      headers: cors,
    },
  );
};

export const config = { path: "/api/pokemontcg" };
