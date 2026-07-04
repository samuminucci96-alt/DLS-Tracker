export function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

export async function findUserRecord(store, email) {
  const normalized = normalizeEmail(email);
  const raw = String(email || "").trim();
  const keys = [...new Set([normalized, raw].filter(Boolean))];

  for (const key of keys) {
    const user = await store.get(key, { type: "json" });
    if (user) return { user, key, normalized };
  }
  return null;
}

export async function saveUserRecord(store, normalized, user, oldKey) {
  const next = { ...user, email: normalized };
  await store.setJSON(normalized, next);
  if (oldKey && oldKey !== normalized) {
    try { await store.delete(oldKey); } catch {}
  }
  return next;
}
