import { getStore } from "@netlify/blobs";
import { randomBytes, pbkdf2 as _pbkdf2, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { signJwt, corsHeaders, requireUser } from "./_lib/jwt.mjs";
import { findUserRecord, saveUserRecord, normalizeEmail } from "./_lib/users.mjs";

const pbkdf2 = promisify(_pbkdf2);

async function hashPass(pass, salt) {
  const key = await pbkdf2(pass, salt, 100000, 64, "sha512");
  return key.toString("hex");
}

function authResponse(user, email) {
  return new Response(JSON.stringify({
    token: signJwt({ type: "user", email }, 90 * 24 * 3600),
    email,
    displayName: user.displayName,
    avatar: user.avatar || null,
  }), { headers: corsHeaders });
}

function clearRecoveryFields(user) {
  const next = { ...user };
  delete next.recoverySalt;
  delete next.recoveryHash;
  delete next.recoveryExpiresAt;
  delete next.recoveryIssuedAt;
  return next;
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
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  try {
    let body;
    try { body = await req.json(); }
    catch { return new Response(JSON.stringify({ error: "Body non valido" }), { status: 400, headers: cors }); }

    const { action, email, password, displayName, resetToken, currentPassword, newPassword } = body || {};
    const needsPassword = action === "register" || action === "login" || action === "confirm-reset";
    const needsEmail = action !== "change-password";
    if ((needsEmail && !email) || (needsPassword && !password)) {
      return new Response(JSON.stringify({ error: needsPassword ? "Email e password richieste" : "Email richiesta" }), { status: 400, headers: cors });
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

    if (action === "request-reset") {
      const found = await findUserRecord(store, email);
      if (!found) {
        return new Response(JSON.stringify({ error: "Nessun account trovato con questa email." }), { status: 404, headers: cors });
      }
      const recoveryToken = randomBytes(18).toString("hex");
      const recoverySalt = randomBytes(16).toString("hex");
      const recoveryHash = await hashPass(recoveryToken, recoverySalt);
      const next = {
        ...found.user,
        recoverySalt,
        recoveryHash,
        recoveryIssuedAt: new Date().toISOString(),
        recoveryExpiresAt: Date.now() + (15 * 60 * 1000),
      };
      if (found.key !== found.normalized) {
        await saveUserRecord(store, found.normalized, next, found.key);
      } else {
        await store.setJSON(found.normalized, next);
      }
      return new Response(JSON.stringify({
        email: found.normalized,
        resetToken: recoveryToken,
        expiresInMinutes: 15,
        message: "Codice di recupero generato. Copialo per impostare una nuova password.",
      }), { headers: cors });
    }

    if (action === "confirm-reset") {
      const found = await findUserRecord(store, email);
      if (!found) {
        return new Response(JSON.stringify({ error: "Nessun account trovato con questa email." }), { status: 404, headers: cors });
      }
      const user = found.user;
      if (!user.recoverySalt || !user.recoveryHash || !user.recoveryExpiresAt) {
        return new Response(JSON.stringify({ error: "Richiedi prima un nuovo codice di recupero." }), { status: 400, headers: cors });
      }
      if (Date.now() > Number(user.recoveryExpiresAt)) {
        return new Response(JSON.stringify({ error: "Il codice di recupero è scaduto. Richiedine uno nuovo." }), { status: 400, headers: cors });
      }
      const candidate = await hashPass(resetToken || "", user.recoverySalt);
      if (!passMatches(user.recoveryHash, candidate)) {
        await new Promise(r => setTimeout(r, 500));
        return new Response(JSON.stringify({ error: "Codice di recupero non valido." }), { status: 401, headers: cors });
      }
      if (String(password || '').length < 6) {
        return new Response(JSON.stringify({ error: "Password troppo corta (min 6 caratteri)" }), { status: 400, headers: cors });
      }
      const salt = randomBytes(16).toString("hex");
      const hash = await hashPass(password, salt);
      const updated = clearRecoveryFields({
        ...user,
        salt,
        hash,
        updatedAt: new Date().toISOString(),
      });
      if (found.key !== found.normalized) {
        await saveUserRecord(store, found.normalized, updated, found.key);
      } else {
        await store.setJSON(found.normalized, updated);
      }
      return authResponse(updated, found.normalized);
    }

    if (action === "change-password") {
      const sessionUser = requireUser(req);
      if (!currentPassword || !newPassword) {
        return new Response(JSON.stringify({ error: "Password attuale e nuova password richieste" }), { status: 400, headers: cors });
      }
      if (String(newPassword).length < 6) {
        return new Response(JSON.stringify({ error: "Password troppo corta (min 6 caratteri)" }), { status: 400, headers: cors });
      }
      if (currentPassword === newPassword) {
        return new Response(JSON.stringify({ error: "La nuova password deve essere diversa da quella attuale" }), { status: 400, headers: cors });
      }

      const found = await findUserRecord(store, sessionUser.email);
      if (!found) {
        return new Response(JSON.stringify({ error: "Utente non trovato" }), { status: 404, headers: cors });
      }

      const user = found.user;
      const currentHash = await hashPass(currentPassword, user.salt);
      if (!passMatches(user.hash, currentHash)) {
        await new Promise(r => setTimeout(r, 500));
        return new Response(JSON.stringify({ error: "Password attuale errata." }), { status: 401, headers: cors });
      }

      const salt = randomBytes(16).toString("hex");
      const hash = await hashPass(newPassword, salt);
      const updated = clearRecoveryFields({
        ...user,
        salt,
        hash,
        updatedAt: new Date().toISOString(),
      });

      if (found.key !== found.normalized) {
        await saveUserRecord(store, found.normalized, updated, found.key);
      } else {
        await store.setJSON(found.normalized, updated);
      }

      return authResponse(updated, found.normalized);
    }

    return new Response(JSON.stringify({ error: "Azione non valida" }), { status: 400, headers: cors });
  } catch (e) {
    if (e.message?.includes("Token") || e.message?.includes("Accesso") || e.message?.includes("Sessione")) {
      return new Response(JSON.stringify({ error: "Non autorizzato: " + e.message }), { status: 401, headers: cors });
    }
    console.error("Auth function error:", e);
    return new Response(JSON.stringify({ error: "Errore server autenticazione. Riprova tra poco." }), { status: 500, headers: cors });
  }
};

export const config = { path: "/api/auth" };
