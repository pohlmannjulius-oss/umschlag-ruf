// Nummernliste (laufende Nr. → Bestellnummer) speichern
import { update, json, checkPin } from "../lib/store.mjs";

export default async (req) => {
  if (!checkPin(req)) return json({ error: "pin" }, 401);
  if (req.method !== "PUT") return json({ error: "nur PUT" }, 405);

  const { rows } = await req.json().catch(() => ({}));
  if (!Array.isArray(rows) || !rows.length) return json({ error: "Keine Zeilen" }, 400);

  const map = {};
  for (const r of rows) {
    const code = String(r.code || "").trim().toUpperCase();
    if (!code) continue;
    if (map[code]) continue; // erste Zeile gewinnt
    map[code] = { nr: r.nr ?? null, name: String(r.name || "").trim(), tickets: r.tickets ? Number(r.tickets) : null };
  }
  await update("mapping", { rows: {} }, () => ({ rows: map, updatedAt: new Date().toISOString() }));
  return json({ ok: true, count: Object.keys(map).length });
};

export const config = { path: "/api/mapping" };
