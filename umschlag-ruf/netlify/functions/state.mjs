// Stand für das Tablet + Aktionen (ausgegeben, rückgängig, Testscan, zurücksetzen)
import { readJSON, update, applyScan, EMPTY_STATE, json, checkPin } from "../lib/store.mjs";

export default async (req) => {
  if (!checkPin(req)) return json({ error: "pin" }, 401);

  if (req.method === "GET") {
    const { data } = await readJSON("state", EMPTY_STATE);
    const { data: mapping } = await readJSON("mapping", { rows: {} });
    return json({ ...data, mappingCount: Object.keys(mapping.rows || {}).length, mappingAt: mapping.updatedAt || null, now: new Date().toISOString() });
  }

  const { action, code: rawCode } = await req.json().catch(() => ({}));
  const code = rawCode ? String(rawCode).trim().toUpperCase() : "";

  if (action === "done" || action === "undo") {
    const st = await update("state", EMPTY_STATE, (s) => {
      const o = s.orders[code];
      if (o) { o.status = action === "done" ? "ausgegeben" : "offen"; o.doneAt = action === "done" ? new Date().toISOString() : null; }
      return s;
    });
    return json({ ok: true, order: st.orders[code] || null });
  }

  if (action === "test") {
    const { data: mapping } = await readJSON("mapping", { rows: {} });
    const m = mapping.rows?.[code];
    if (!code) return json({ error: "Bestellnummer fehlt" }, 400);
    await update("state", EMPTY_STATE, (s) => {
      const prev = s.orders[code];
      const total = m?.tickets || prev?.total || 1;
      const inCount = Math.min(total, (prev?.inCount || 0) + 1);
      return applyScan(s, { code, nr: m?.nr, name: m?.name || "Testscan", total, inCount }, "test");
    });
    return json({ ok: true, found: !!m });
  }

  if (action === "reset") {
    await update("state", EMPTY_STATE, () => structuredClone(EMPTY_STATE));
    return json({ ok: true });
  }

  return json({ error: "unbekannte Aktion" }, 400);
};

export const config = { path: "/api/state" };
