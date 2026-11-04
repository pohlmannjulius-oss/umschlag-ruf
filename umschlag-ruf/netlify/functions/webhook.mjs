// Empfängt pretix-Webhooks ("Ticket eingecheckt" / "Check-in zurückgenommen")
import { readJSON, update, applyScan, EMPTY_STATE, json } from "../lib/store.mjs";

const ACTIONS = ["pretix.event.checkin", "pretix.event.checkin.reverted"];

export async function fetchOrder(org, event, code) {
  const base = (process.env.PRETIX_URL || "https://pretix.eu").replace(/\/$/, "");
  const url = `${base}/api/v1/organizers/${encodeURIComponent(org)}/events/${encodeURIComponent(event)}/orders/${encodeURIComponent(code)}/`;
  const res = await fetch(url, { headers: { Authorization: `Token ${process.env.PRETIX_TOKEN}` } });
  if (!res.ok) throw new Error(`pretix antwortet ${res.status}`);
  return res.json();
}

export function summarize(order, positionId) {
  const listId = process.env.CHECKIN_LIST_ID ? Number(process.env.CHECKIN_LIST_ID) : null;
  const tickets = (order.positions || []).filter((p) => !p.addon_to && !p.canceled);
  const isIn = (p) => (p.checkins || []).some((c) => (c.type || "entry") === "entry" && (!listId || c.list === listId));
  const name =
    order.invoice_address?.name ||
    tickets.find((p) => p.attendee_name)?.attendee_name ||
    order.email || "";
  const scanned = tickets.find((p) => p.id === Number(positionId))?.attendee_name || "";
  const present = tickets.filter(isIn).map((p) => p.attendee_name).filter(Boolean);
  return { total: tickets.length, inCount: tickets.filter(isIn).length, name, scanned, present };
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
  const { data: mapping } = await readJSON("mapping", { rows: {} });
  const m = mapping.rows?.[code] || {};

  let info;
  try {
    const s = summarize(await fetchOrder(body.organizer, body.event, code), body.orderposition_id ?? body.position);
    info = { code, nr: m.nr, name: m.name || s.name, total: s.total, inCount: s.inCount, scanned: s.scanned, present: s.present };
  } catch (e) {
    // pretix nicht erreichbar: trotzdem anzeigen, damit niemand übersehen wird
    const isRevert = body.action.endsWith("reverted");
    info = { code, nr: m.nr, name: m.name || "", total: null, inCount: isRevert ? 0 : 1, note: "Details nicht abrufbar" };
  }

  await update("state", EMPTY_STATE, (st) => applyScan(st, info, body.action.endsWith("reverted") ? "zurück" : "check-in"));
  return json({ ok: true });
};

export const config = { path: "/api/webhook" };
