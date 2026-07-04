import { getStore } from "@netlify/blobs";
import { requireUser, corsHeaders } from "./_lib/jwt.mjs";
import { findUserRecord } from "./_lib/users.mjs";

export default async (req) => {
  const cors = corsHeaders;
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  try {
    const user = requireUser(req);
    const users = getStore({ name: "dls-users", consistency: "strong" });
    const found = await findUserRecord(users, user.email);
    const emailKey = found?.normalized || user.email;
    const store = getStore({ name: "dls-collections", consistency: "strong" });
    const key = `user:${emailKey}`;

    if (req.method === "GET") {
      const data = await store.get(key, { type: "json" });
      return new Response(JSON.stringify(data || []), { headers: cors });
    }

    if (req.method === "POST") {
      const collection = await req.json();
      if (!Array.isArray(collection)) {
        return new Response(JSON.stringify({ error: "Payload deve essere un array" }), { status: 400, headers: cors });
      }
      const clean = collection.map(item => {
        const { _localOnly, ...rest } = item;
        return rest;
      });
      await store.setJSON(key, clean);
      return new Response(JSON.stringify({ ok: true, count: clean.length }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: "Metodo non supportato" }), { status: 405, headers: cors });
  } catch (e) {
    if (e.message?.includes("Token") || e.message?.includes("Accesso") || e.message?.includes("Sessione")) {
      return new Response(JSON.stringify({ error: "Non autorizzato: " + e.message }), { status: 401, headers: cors });
    }
    console.error("Collection function error:", e);
    return new Response(JSON.stringify({ error: "Errore server collezione. Riprova tra poco." }), { status: 500, headers: cors });
  }
};

export const config = { path: "/api/collection" };
