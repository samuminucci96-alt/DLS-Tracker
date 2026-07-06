import { getStore } from "@netlify/blobs";
import { requireUser, corsHeaders } from "./_lib/jwt.mjs";
import { findUserRecord, saveUserRecord } from "./_lib/users.mjs";

const MAX_AVATAR_LEN = 180000;

export default async (req) => {
  const cors = corsHeaders;
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  try {
    const user = requireUser(req);
    const store = getStore({ name: "dls-users", consistency: "strong" });
    const found = await findUserRecord(store, user.email);
    if (!found) {
      return new Response(JSON.stringify({ error: "Utente non trovato" }), { status: 404, headers: cors });
    }
    let record = found.user;
    if (found.key !== found.normalized) {
      record = await saveUserRecord(store, found.normalized, record, found.key);
    }

    if (req.method === "GET") {
      return new Response(JSON.stringify({
        email: record.email,
        displayName: record.displayName || record.email.split("@")[0],
        avatar: record.avatar || null,
      }), { headers: cors });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const next = { ...record };

      if (typeof body.displayName === "string") {
        const name = body.displayName.trim().slice(0, 40);
        if (name) next.displayName = name;
      }

      if (body.avatar === null) {
        delete next.avatar;
      } else if (typeof body.avatar === "string") {
        if (!body.avatar.startsWith("data:image/")) {
          return new Response(JSON.stringify({ error: "Formato immagine non valido" }), { status: 400, headers: cors });
        }
        if (body.avatar.length > MAX_AVATAR_LEN) {
          return new Response(JSON.stringify({ error: "Immagine troppo grande (max ~120 KB)" }), { status: 400, headers: cors });
        }
        next.avatar = body.avatar;
      }

      next.updatedAt = new Date().toISOString();
      await store.setJSON(found.normalized, next);

      return new Response(JSON.stringify({
        email: next.email,
        displayName: next.displayName,
        avatar: next.avatar || null,
      }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: "Metodo non supportato" }), { status: 405, headers: cors });
  } catch (e) {
    if (e.message?.includes("Token") || e.message?.includes("Accesso") || e.message?.includes("Sessione")) {
      return new Response(JSON.stringify({ error: "Non autorizzato: " + e.message }), { status: 401, headers: cors });
    }
    console.error("Profile function error:", e);
    return new Response(JSON.stringify({ error: "Errore server profilo" }), { status: 500, headers: cors });
  }
};

export const config = { path: "/api/profile" };
