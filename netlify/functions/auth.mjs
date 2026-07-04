import { getStore } from "@netlify/blobs";
import { randomBytes, pbkdf2 as _pbkdf2, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { signJwt, corsHeaders } from "./_lib/jwt.mjs";
import { findUserRecord, saveUserRecord, normalizeEmail } from "./_lib/users.mjs";

const pbkdf2 = promisify(_pbkdf2);

async function hashPass(pass, salt) {
  const key = await pbkdf2(pass, salt, 100000, 64, "sha512");
  return key.toString("hex");
}

function passMatches(storedHash, candidateHash) {
  if (!storedHash || !candidateHash) return false;
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(candidateHash, "hex");
  if (a.length !== b.length) return storedHash === candidateHash;
  return timingSafeEqual(a, b);
}

export default async (req) => {
  const cors = corsHeaders;
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  try {
    let body;
    try { body = await req.json(); }
    catch { return new Response(JSON.stringify({ error: "Body non valido" }), { status: 400, headers: cors }); }

    const { action, email, password, displayName } = body || {};
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email e password richieste" }), { status: 400, headers: cors });
    }

    const store = getStore({ name: "dls-users", consistency: "strong" });
    const userKey = normalizeEmail(email);

    if (action === "register") {
      const existing = await findUserRecord(store, email);
      if (existing) {
        return new Response(JSON.stringify({ error: "Email già registrata. Accedi invece." }), { status: 409, headers: cors });
      }
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "Password troppo corta (min 6 caratteri)" }), { status: 400, headers: cors });
      }
      const salt = randomBytes(16).toString("hex");
      const hash = await hashPass(password, salt);
      await store.setJSON(userKey, {
        email: userKey, displayName: displayName || email.split("@")[0],
        salt, hash, createdAt: new Date().toISOString(),
      });
      const token = signJwt({ type: "user", email: userKey }, 90 * 24 * 3600);
      return new Response(JSON.stringify({
        token, email: userKey,
        displayName: displayName || email.split("@")[0],
        avatar: null,
      }), { headers: cors });
    }

    if (action === "login") {
      const found = await findUserRecord(store, email);
      if (!found) {
        return new Response(JSON.stringify({ error: "Nessun account trovato con questa email." }), { status: 404, headers: cors });
      }
      let user = found.user;
      const hash = await hashPass(password, user.salt);
      if (!passMatches(user.hash, hash)) {
        await new Promise(r => setTimeout(r, 600));
        return new Response(JSON.stringify({ error: "Password errata." }), { status: 401, headers: cors });
      }
      if (found.key !== found.normalized) {
        user = await saveUserRecord(store, found.normalized, user, found.key);
      }
      const token = signJwt({ type: "user", email: found.normalized }, 90 * 24 * 3600);
      return new Response(JSON.stringify({
        token, email: found.normalized,
        displayName: user.displayName,
        avatar: user.avatar || null,
      }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: "Azione non valida" }), { status: 400, headers: cors });
  } catch (e) {
    console.error("Auth function error:", e);
    return new Response(JSON.stringify({ error: "Errore server autenticazione. Riprova tra poco." }), { status: 500, headers: cors });
  }
};

export const config = { path: "/api/auth" };
