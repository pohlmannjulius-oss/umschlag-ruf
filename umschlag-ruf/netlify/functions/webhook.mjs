// Empfängt pretix-Webhooks ("Ticket eingecheckt" / "Check-in zurückgenommen")
// und verteilt sie je nach Check-in-Liste auf Umschläge oder Tombola
import { readJSON, update, applyScan, EMPTY_STATE, json } from "../lib/store.mjs";
import { fetchOrder, resolveList, envelopeListFilter } from "../lib/pretix.mjs";
import { applyTombolaScan, EMPTY_TOMBOLA } from "../lib/tombola.mjs";

const ACTIONS = ["pretix.event.checkin", "pretix.event.checkin.reverted"];

export function summarize(order, positionId, isEnvelopeList = () => true) {
  const tickets = (order.positions || []).filter((p) => !p.addon_to && !p.canceled);
  const isIn = (p) => (p.checkins || []).some((c) => (c.type || "entry") === "entry" && isEnvelopeList(c.list));
  const name =
    order.invoice_address?.name ||
    tickets.find((p) => p.attendee_name)?.attendee_name ||
    order.email || "";
  const pos = tickets.find((p) => p.id === Number(positionId));
  const present = tickets.filter(isIn).map((p) => p.attendee_name).filter(Boolean);
  return {
    total: tickets.length, inCount: tickets.filter(isIn).length, name, present,
    scanned: pos?.attendee_name || "",
    scannedEmail: pos?.attendee_email || order.email || "",
  };
}

export default async (req) => {
  const key = (new URL(req.url).searchParams.get("key") || "").trim();
  const expected = (process.env.WEBHOOK_KEY || "").trim();
  if (!expected) { console.log("WEBHOOK_KEY ist in Netlify nicht gesetzt"); return json({ error: "WEBHOOK_KEY fehlt" }, 401); }
  if (key !== expected) { console.log(`Key passt nicht (erwartet ${expected.length} Zeichen, bekommen ${key.length})`); return json({ error: "unauthorized" }, 401); }

  let body;
  try { body = await req.json(); } catch { return json({ ok: true, ignored: "kein JSON" }); }
  if (!ACTIONS.includes(body.action) || !body.code) return json({ ok: true, ignored: body.action });

  const code = String(body.code).toUpperCase();
  const isRevert = body.action.endsWith("reverted");
  const positionId = body.orderposition_id ?? null;
  const { role, cfg } = await resolveList(body.organizer, body.event, body.checkin_list);
  if (role !== "umschlag" && role !== "tombola") return json({ ok: true, ignored: `Liste ${body.checkin_list} (${role})` });

  const { data: mapping } = await readJSON("mapping", { rows: {} });
  const m = mapping.rows?.[code] || {};

  let order = null;
  try { order = await fetchOrder(body.organizer, body.event, code); } catch (e) { console.log("Bestellung nicht abrufbar:", e.message); }

  if (role === "tombola") {
    const s = order ? summarize(order, positionId) : null;
    await update("tombola", EMPTY_TOMBOLA, (t) => applyTombolaScan(t, {
      code, positionId, nr: m.nr, revert: isRevert,
      notificationId: body.notification_id ? `${body.notification_id}` : null,
      name: s ? (s.scanned || s.name) : m.name || "",
      email: s?.scannedEmail || "",
      note: order ? "" : "Details nicht abrufbar",
    }));
    return json({ ok: true, role });
  }

  let info;
  if (order) {
    const s = summarize(order, positionId, envelopeListFilter(cfg));
    info = { code, nr: m.nr, name: m.name || s.name, total: s.total, inCount: s.inCount, scanned: s.scanned, present: s.present };
  } else {
    // pretix nicht erreichbar: trotzdem anzeigen, damit niemand übersehen wird
    info = { code, nr: m.nr, name: m.name || "", total: null, inCount: isRevert ? 0 : 1, note: "Details nicht abrufbar" };
  }
  await update("state", EMPTY_STATE, (st) => applyScan(st, info, isRevert ? "zurück" : "check-in"));
  return json({ ok: true, role });
};

export const config = { path: "/api/webhook" };
