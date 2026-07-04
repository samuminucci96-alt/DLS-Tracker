import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.JWT_SECRET || "dls-default-change-me-in-prod";

export function b64url(str) {
  return Buffer.from(str).toString("base64url");
}

export function signJwt(payload, ttlSec = 7 * 24 * 3600) {
  const h = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const b = b64url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  }));
  const sig = createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url");
  return `${h}.${b}.${sig}`;
}

export function verifyJwt(token) {
  if (!token) throw new Error("Token mancante");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token malformato");
  const [h, b, sig] = parts;
  const expected = createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Firma token non valida");
  }
  const payload = JSON.parse(Buffer.from(b, "base64url").toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Token scaduto");
  return payload;
}

export function extractBearer(req) {
  return (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

export function requireUser(req) {
  const userToken = (req.headers.get("X-DLS-Session") || "").trim();
  if (!userToken) throw new Error("Sessione utente mancante");
  const user = verifyJwt(userToken);
  if (user.type && user.type !== "user") throw new Error("Sessione utente non valida");
  if (!user.email) throw new Error("Sessione utente non valida");
  return user;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-DLS-Session",
  "Content-Type": "application/json",
};
