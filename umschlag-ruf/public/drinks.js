/* Getränke-Reiter: zeigt beim Scan an, ob noch ein Heißgetränk zusteht.
   Nutzt Globals aus index.html ($, esc, state, tApi, poll, setHtml, time, beep, flash, sound, ac). */
let drinkSeen;

function drinkBuzz() {
  if (!sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    [0, .22].forEach((d) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "square"; o.frequency.value = 160;
      g.gain.setValueAtTime(.0001, ac.currentTime + d); g.gain.exponentialRampToValueAtTime(.18, ac.currentTime + d + .02); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d + .18);
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + d); o.stop(ac.currentTime + d + .2); });
  } catch {}
}

function renderDrinks() {
  const dr = state.drinks || { limit: 2, perTicket: {}, feed: [] };
  const lim = dr.limit || 2;
  const tickets = Object.values(dr.perTicket || {}).filter((t) => t.times.length);
  const served = tickets.reduce((s, t) => s + t.times.length, 0);
  const denied = (dr.feed || []).filter((f) => f.status === "abgelehnt").length;
  $("dServed").textContent = served; $("dDenied").textContent = denied;
  if (document.activeElement !== $("dLimit")) $("dLimit").value = lim;

  const last = (dr.feed || []).find((f) => f.id === dr.lastId);
  // neuer Scan → Ton und Aufblitzen
  if (drinkSeen !== undefined && dr.lastId && dr.lastId !== drinkSeen && last) {
    if (last.status === "abgelehnt") drinkBuzz(); else beep();
    if (tab === "D") flash("dHero");
  }
  drinkSeen = dr.lastId || null;

  const h = $("dHero");
  h.classList.remove("d-ok", "d-last", "d-no");
  if (!last) {
    setHtml("dHero", `<div class="empty"><strong>Bereit</strong>Ticket auf der Liste „Getränke“ scannen.<br>Pro Ticket gibt es ${lim} Heißgetränke.</div>`);
  } else {
    const no = last.status === "abgelehnt", rev = last.status === "zurück";
    h.classList.add(no ? "d-no" : last.status === "letztes" ? "d-last" : "d-ok");
    const dots = Array.from({ length: lim }, (_, i) => `<i class="${i < last.count ? "on" : ""}"></i>`).join("");
    setHtml("dHero", `
      <div class="label">${rev ? "Scan zurückgenommen" : no ? "Kein Getränk mehr" : "Heißgetränk ausgeben"}</div>
      <div class="dbig">${no ? `Schon ${last.count} abgeholt` : rev ? `${last.count} von ${lim}` : `${last.count} von ${lim}`}</div>
      <div class="ddots">${dots}</div>
      <div class="dsub">${no ? `Abgeholt um ${last.prev.map((t) => time(t).slice(0, 5)).join(" und ")} Uhr`
        : rev ? "Getränk wieder gutgeschrieben" : last.status === "letztes" ? "Das ist das letzte Getränk für dieses Ticket" : `Danach noch ${lim - last.count} frei`}</div>
      <div class="name">${esc(last.name || "—")}</div>
      <div class="meta"><span class="pill code">${esc(last.code)}</span>${last.nr ? `<span class="pill">Umschlag ${esc(last.nr)}</span>` : ""}<span class="pill">${time(last.t)}</span>${last.test ? `<span class="pill">Testscan</span>` : ""}</div>`);
  }

  $("dFeedInfo").textContent = tickets.length ? `${tickets.length} Tickets` : "";
  setHtml("dFeed", (dr.feed || []).length ? dr.feed.slice(0, 40).map((f) => `
    <div class="row">
      <div class="n dcount ${f.status === "abgelehnt" ? "no" : f.status === "letztes" ? "last" : ""}">${f.status === "abgelehnt" ? "✕" : f.status === "zurück" ? "↺" : `${f.count}/${lim}`}</div>
      <div><div class="who" style="font-size:16px">${esc(f.name || f.code)}</div>
        <div class="sub">${esc(f.code)} · ${f.status === "abgelehnt" ? `abgewiesen – schon ${f.count} abgeholt` : f.status === "zurück" ? "Scan zurückgenommen" : f.status === "letztes" ? "letztes Getränk" : "Getränk ausgegeben"}${f.test ? " · Test" : ""}</div></div>
      <div class="t">${time(f.t)}</div>
    </div>`).join("") : `<div class="none">Noch keine Scans.</div>`);
}

$("dLimitForm").onsubmit = async (e) => {
  e.preventDefault();
  try { await tApi({ action: "drinksLimit", limit: $("dLimit").value }); $("dLimit").blur(); } catch (err) { alert(err.message); }
  poll();
};
$("dTestBtn").onclick = async () => {
  const code = $("dTestCode").value.trim() || "TEST";
  try { await tApi({ action: "drinksTest", code }); } catch (err) { alert(err.message); }
  poll();
};
$("dResetBtn").onclick = async () => {
  if (!confirm("Alle Getränke-Zählungen zurücksetzen? Danach hat jedes Ticket wieder alle Getränke frei.")) return;
  await tApi({ action: "drinksReset" }).catch(() => {}); poll();
};
