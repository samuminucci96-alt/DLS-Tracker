import { corsHeaders } from "./_lib/jwt.mjs";

const CT_BASE = "https://api.cardtrader.com/api/v2";
const ALLOWED_PREFIXES = ["/games", "/expansions", "/blueprints", "/marketplace"];
const CT_TIMEOUT_MS = Math.max(3000, Number.parseInt(process.env.CARDTRADER_TIMEOUT_MS || "10000", 10) || 10000);
const CT_RETRY_ATTEMPTS = Math.max(0, Number.parseInt(process.env.CARDTRADER_RETRY_ATTEMPTS || "1", 10) || 1);
const CT_RETRY_BASE_DELAY_MS = Math.max(50, Number.parseInt(process.env.CARDTRADER_RETRY_DELAY_MS || "200", 10) || 200);
const CT_RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const CT_CACHE_TTL_MS = Math.max(1000, Number.parseInt(process.env.CARDTRADER_CACHE_TTL_MS || "60000", 10) || 60000);
const CT_CACHE_MAX_ENTRIES = Math.max(10, Number.parseInt(process.env.CARDTRADER_CACHE_MAX_ENTRIES || "200", 10) || 200);
const CT_NO_CACHE_PREFIXES = ["/marketplace/"];

const ctResponseCache = new Map();
const ctInflight = new Map();

function getCachedEntry(key) {
  const hit = ctResponseCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    ctResponseCache.delete(key);
    return null;
  }
  return hit;
}

function pruneCacheIfNeeded() {
  if (ctResponseCache.size <= CT_CACHE_MAX_ENTRIES) return;
  const entries = [...ctResponseCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  const toDrop = entries.slice(0, Math.max(1, entries.length - CT_CACHE_MAX_ENTRIES));
  toDrop.forEach(([k]) => ctResponseCache.delete(k));
}

function setCachedEntry(key, value) {
  ctResponseCache.set(key, {
    ...value,
    expiresAt: Date.now() + CT_CACHE_TTL_MS,
  });
  pruneCacheIfNeeded();
}

function shouldCachePath(path) {
  return !CT_NO_CACHE_PREFIXES.some((prefix) => path.startsWith(prefix));
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

async function retryBackoff(attempt) {
  await new Promise((resolve) => setTimeout(resolve, CT_RETRY_BASE_DELAY_MS * attempt));
}

async function ctFetchWithRetry(ctUrl, headers) {
  const maxAttempts = 1 + CT_RETRY_ATTEMPTS;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CT_TIMEOUT_MS);
    try {
      const res = await fetch(ctUrl, { headers, signal: ctrl.signal });
      const contentType = res.headers.get("Content-Type") || "application/json";
      const body = await res.text();

      if (CT_RETRYABLE_STATUS.has(res.status) && attempt < maxAttempts) {
        await retryBackoff(attempt);
        continue;
      }
      return { body, status: res.status, contentType, attempts: attempt };
    } catch (err) {
      lastError = err;
      if (!isRetryableFetchError(err) || attempt >= maxAttempts) {
        return { error: err, attempts: attempt };
      }
      await retryBackoff(attempt);
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
  const path = url.searchParams.get("path") || "";
  if (!path.startsWith("/") || path.includes("..")) {
    return new Response(JSON.stringify({ error: "Path non valido" }), { status: 400, headers: cors });
  }
  if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return new Response(JSON.stringify({ error: "Path non consentito" }), { status: 403, headers: cors });
  }

  const token = process.env.CARDTRADER_API_TOKEN || process.env.CARDTRADER_API_KEY;
  if (!token) {
    return new Response(JSON.stringify({ error: "Servizio CardTrader non configurato sul server" }), { status: 503, headers: cors });
  }

  const cacheable = shouldCachePath(path);
  if (cacheable) {
    const cached = getCachedEntry(path);
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
  }

  const ctUrl = `${CT_BASE}${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  if (!ctInflight.has(path)) {
    ctInflight.set(path, ctFetchWithRetry(ctUrl, headers));
  }

  let result;
  try {
    result = await ctInflight.get(path);
  } finally {
    ctInflight.delete(path);
  }

  const { body, status, contentType: resContentType, error } = result || {};

  if (body !== undefined) {
    const contentType = resContentType || "application/json";
    if (cacheable && status >= 200 && status < 300) {
      setCachedEntry(path, { status, contentType, body });
    }
    return new Response(body, {
      status,
      headers: {
        ...cors,
        "Content-Type": contentType,
        "X-DLS-Cache": cacheable ? "MISS" : "BYPASS",
      },
    });
  }

  const isAbort = error?.name === "AbortError";
  return new Response(
    JSON.stringify({
      error: isAbort
        ? "Timeout verso CardTrader API"
        : "Errore di connessione verso CardTrader API",
      detail: isAbort ? `Scaduto dopo ${CT_TIMEOUT_MS}ms` : (error?.message || "Errore sconosciuto"),
    }),
    {
      status: isAbort ? 504 : 502,
      headers: cors,
    },
  );
};

export const config = { path: "/api/cardtrader" };
