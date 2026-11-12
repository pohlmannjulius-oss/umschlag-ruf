// Nummernliste (laufende Nr. → Bestellnummer) speichern und abrufen
import { update, readJSON, json, checkPin } from "../lib/store.mjs";

export default async (req) => {
  if (!checkPin(req)) return json({ error: "pin" }, 401);

  if (req.method === "GET") {
    const { data } = await readJSON("mapping", { rows: {} });
    return json({ rows: data.rows || {}, updatedAt: data.updatedAt || null });
  }
  if (req.method !== "PUT") return json({ error: "nur GET/PUT" }, 405);

  const { rows } = await req.json().catch(() => ({}));
  if (!Array.isArray(rows) || !rows.length) return json({ error: "Keine Zeilen" }, 400);

  const map = {};
  for (const r of rows) {
    const code = String(r.code || "").trim().toUpperCase();
    if (!code) continue;
    if (map[code]) continue; // erste Zeile gewinnt
    map[code] = {
      nr: r.nr ?? null, name: String(r.name || "").trim(), tickets: r.tickets ? Number(r.tickets) : null,
      people: String(r.people || "").trim().slice(0, 500),
    };
  }
  await update("mapping", { rows: {} }, () => ({ rows: map, updatedAt: new Date().toISOString() }));
  return json({ ok: true, count: Object.keys(map).length });
};

export const config = { path: "/api/mapping" };
