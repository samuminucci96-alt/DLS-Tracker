import { getStore } from "@netlify/blobs";
import { corsHeaders } from "./_lib/jwt.mjs";

const SCRYFALL_BASE = "https://api.scryfall.com";
const BATCH_SECRET = String(process.env.MTG_BATCH_SECRET || "").trim();
const MTG_BATCH_TIMEOUT_MS = Math.max(3000, Number.parseInt(process.env.MTG_BATCH_TIMEOUT_MS || "12000", 10) || 12000);
const MTG_BATCH_RETRY_ATTEMPTS = Math.max(0, Number.parseInt(process.env.MTG_BATCH_RETRY_ATTEMPTS || "2", 10) || 2);
const MTG_BATCH_RETRY_DELAY_MS = Math.max(50, Number.parseInt(process.env.MTG_BATCH_RETRY_DELAY_MS || "200", 10) || 200);
const MTG_BATCH_DELAY_MS = Math.min(250, Math.max(50, Number.parseInt(process.env.MTG_BATCH_DELAY_MS || "80", 10) || 80));
const MTG_RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const PRICE_HISTORY_MAX = 40;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function scryfallFetchById(id) {
  const maxAttempts = 1 + MTG_BATCH_RETRY_ATTEMPTS;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), MTG_BATCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${SCRYFALL_BASE}/cards/${encodeURIComponent(id)}`, {
        headers: { Accept: "application/json", "User-Agent": "DLS-Tracker/1.0" },
        signal: ctrl.signal,
      });

      if (MTG_RETRYABLE_STATUS.has(res.status) && attempt < maxAttempts) {
        await sleep(MTG_BATCH_RETRY_DELAY_MS * attempt);
        continue;
      }

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const errMsg = payload?.details || payload?.error || `Scryfall ${res.status}`;
        return { error: new Error(String(errMsg)), status: res.status };
      }
      return { data: payload, status: res.status };
    } catch (err) {
      lastError = err;
      if (!isRetryableFetchError(err) || attempt >= maxAttempts) {
        return { error: err, status: 0 };
      }
      await sleep(MTG_BATCH_RETRY_DELAY_MS * attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  return { error: lastError || new Error("Errore Scryfall sconosciuto"), status: 0 };
}

function normalizePrice(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return parseFloat(n.toFixed(2));
}

function resolveUnitPrice(item, eur, eurFoil) {
  const isFoil = !!item?.isFoil;
  if (isFoil) return eurFoil ?? eur;
  return eur ?? eurFoil;
}

function canonicalPriceMode(itemOrMode, maybeManual = false) {
  const mode = typeof itemOrMode === "string"
    ? itemOrMode
    : (itemOrMode?.priceMode || "");
  const manual = typeof itemOrMode === "string"
    ? maybeManual
    : !!itemOrMode?.manualPrice;

  if (manual || mode === "manual") return "manual";
  if (mode === "listing" || mode === "min_ct" || mode === "live") return "live";
  if (mode === "estimate") return "estimate";
  return mode || "estimate";
}

function ensurePriceHistory(item) {
  if (!Array.isArray(item.priceHistory)) item.priceHistory = [];
  return item.priceHistory;
}

function appendPriceHistory(item, payload = {}) {
  if (!item) return false;
  const history = ensurePriceHistory(item);
  const round = (v) => (Number.isFinite(Number(v)) ? parseFloat(Number(v).toFixed(2)) : null);

  const prevPrice = payload.prevPrice === null ? null : round(payload.prevPrice);
  const nextPrice = payload.nextPrice === null ? null : round(payload.nextPrice);
  const prevMode = payload.prevMode || null;
  const nextMode = payload.nextMode || null;
  const changed = payload.force || prevPrice !== nextPrice || prevMode !== nextMode;
  if (!changed) return false;

  history.push({
    ts: payload.ts || new Date().toISOString(),
    reason: payload.reason || "update",
    prevPrice,
    nextPrice,
    prevMode,
    nextMode,
  });

  if (history.length > PRICE_HISTORY_MAX) {
    history.splice(0, history.length - PRICE_HISTORY_MAX);
  }
  return true;
}

function isAuthorized(req) {
  if (!BATCH_SECRET) return false;
  const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const headerSecret = (req.headers.get("X-DLS-Batch-Secret") || "").trim();
  return auth === BATCH_SECRET || headerSecret === BATCH_SECRET;
}

async function listAllCollectionKeys(store, prefix = "user:", maxKeys = 2000) {
  const out = [];
  let cursor = undefined;

  while (out.length < maxKeys) {
    const page = await store.list({ prefix, cursor, limit: 100 });
    const blobs = Array.isArray(page?.blobs) ? page.blobs : [];
    blobs.forEach((blob) => {
      if (blob?.key) out.push(blob.key);
    });

    if (!page?.cursor || blobs.length === 0) break;
    cursor = page.cursor;
  }

  return out;
}

export default async (req) => {
  const cors = corsHeaders;
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (!["POST", "GET"].includes(req.method)) {
    return new Response(JSON.stringify({ error: "Metodo non supportato" }), { status: 405, headers: cors });
  }

  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: "Non autorizzato" }), { status: 401, headers: cors });
  }

  const reqUrl = new URL(req.url);
  const userLimit = Math.max(1, Math.min(2000, Number.parseInt(reqUrl.searchParams.get("userLimit") || "250", 10) || 250));
  const cardLimit = Math.max(1, Math.min(20000, Number.parseInt(reqUrl.searchParams.get("cardLimit") || "5000", 10) || 5000));
  const delayMs = Math.max(50, Math.min(250, Number.parseInt(reqUrl.searchParams.get("delayMs") || String(MTG_BATCH_DELAY_MS), 10) || MTG_BATCH_DELAY_MS));

  const collectionsStore = getStore({ name: "dls-collections", consistency: "strong" });

  const summary = {
    ok: true,
    users_scanned: 0,
    users_updated: 0,
    mtg_cards_seen: 0,
    prices_updated: 0,
    manual_skipped: 0,
    cards_without_price: 0,
    errors: 0,
    delay_ms: delayMs,
    fetched_at: new Date().toISOString(),
  };

  try {
    const keys = await listAllCollectionKeys(collectionsStore, "user:", userLimit);

    for (const key of keys) {
      if (summary.mtg_cards_seen >= cardLimit) break;
      summary.users_scanned++;

      const collection = await collectionsStore.get(key, { type: "json" });
      if (!Array.isArray(collection) || collection.length === 0) continue;

      let touchedUser = false;

      for (let i = 0; i < collection.length; i++) {
        if (summary.mtg_cards_seen >= cardLimit) break;

        const item = collection[i];
        if ((item?.game || "pokemon") !== "mtg") continue;
        if (!item?.scryfallId) continue;

        summary.mtg_cards_seen++;

        const itemRef = collection[i];
        itemRef.mtgPriceEur = itemRef.mtgPriceEur ?? null;
        itemRef.mtgPriceEurFoil = itemRef.mtgPriceEurFoil ?? null;

        const hit = await scryfallFetchById(item.scryfallId);
        if (hit?.error || !hit?.data) {
          summary.errors++;
          await sleep(delayMs);
          continue;
        }

        const eur = normalizePrice(hit.data?.prices?.eur);
        const eurFoil = normalizePrice(hit.data?.prices?.eur_foil);
        itemRef.mtgPriceEur = eur;
        itemRef.mtgPriceEurFoil = eurFoil;
        itemRef.lastPriceSyncAt = new Date().toISOString();

        if (itemRef.manualPrice || itemRef.priceMode === "manual") {
          summary.manual_skipped++;
          touchedUser = true;
          await sleep(delayMs);
          continue;
        }

        const unit = resolveUnitPrice(itemRef, eur, eurFoil);
        if (unit == null) {
          summary.cards_without_price++;
          touchedUser = true;
          await sleep(delayMs);
          continue;
        }

        const prevPrice = Number.isFinite(Number(itemRef.price)) ? Number(itemRef.price) : null;
        const prevMode = canonicalPriceMode(itemRef);
        const nextPrice = parseFloat(Number(unit).toFixed(2));

        itemRef.price = nextPrice;
        itemRef.ctPrice = nextPrice;
        itemRef.priceMode = "live";
        itemRef.priceSrc = "Scryfall EUR";
        itemRef.lastPriceUpdate = new Date().toISOString();

        appendPriceHistory(itemRef, {
          reason: "refresh_scryfall_batch",
          prevPrice,
          nextPrice,
          prevMode,
          nextMode: canonicalPriceMode(itemRef),
        });

        summary.prices_updated++;
        touchedUser = true;

        await sleep(delayMs);
      }

      if (touchedUser) {
        summary.users_updated++;
        await collectionsStore.setJSON(key, collection);
      }
    }

    return new Response(JSON.stringify(summary), { status: 200, headers: cors });
  } catch (err) {
    console.error("MTG batch refresh error:", err);
    return new Response(JSON.stringify({
      ...summary,
      ok: false,
      error: err?.message || "Errore interno batch MTG",
    }), { status: 500, headers: cors });
  }
};

export const config = { path: "/api/mtg-batch-refresh" };
