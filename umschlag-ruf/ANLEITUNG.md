# Umschlag-Ruf – Einrichtung

Ablauf am Event: Ticket wird mit pretixSCAN gescannt → pretix meldet den Check-in an die Website → das Tablet zeigt groß die Umschlagnummer, die Bestellnummer, den Namen und wie viele Personen der Bestellung schon da sind. Pro Bestellung erscheint der Umschlag nur einmal, auch wenn die ganze Familie nacheinander gescannt wird.

## 1. Website auf Netlify online bringen

Die Seite braucht kleine Server-Funktionen, deshalb funktioniert das Hochziehen per Drag & Drop hier **nicht**. Zwei Wege:

**A) Über GitHub (empfohlen)**
1. Neues privates Repository auf GitHub anlegen, den Inhalt dieses Ordners hochladen (ohne `node_modules`).
2. Netlify → *Add new project* → *Import an existing project* → GitHub → Repository wählen. Build-Einstellungen nicht ändern (stehen in `netlify.toml`) → *Deploy*.

**B) Über die Kommandozeile** (Node.js muss installiert sein)
1. Terminal in diesem Ordner öffnen.
2. `npx netlify-cli login`, dann `npx netlify-cli deploy --prod` und den Fragen folgen (neues Projekt anlegen).

## 2. Umgebungsvariablen in Netlify

Netlify → Projekt → *Project configuration* → *Environment variables* → hinzufügen:

| Name | Wert |
|---|---|
| `PRETIX_TOKEN` | API-Token aus pretix (Schritt 3) |
| `WEBHOOK_KEY` | ein langes, selbst ausgedachtes Passwort, z. B. 24 zufällige Buchstaben/Ziffern |
| `APP_PIN` | PIN, mit der das Tablet die Seite öffnet, z. B. 4–6 Ziffern |
| `CHECKIN_LIST_ID` | optional: nur Check-ins dieser Liste zählen |
| `PRETIX_URL` | nur nötig, wenn ihr nicht pretix.eu nutzt |

Danach unter *Deploys* → *Trigger deploy* → *Deploy project*, damit die Werte greifen.

## 3. pretix einrichten

**Testevent**
1. *Veranstalter → Veranstaltungen → Neue Veranstaltung* (oder Flutlicht-Event kopieren).
2. *Einstellungen → Shop*: Testmodus an, Shop live schalten.
3. Testbestellungen machen: mindestens eine mit 3–4 Tickets, eine mit 1 Ticket. Als bezahlt markieren.

**API-Token**
1. *Veranstalter → Teams → Neues Team* „Check-in-Tablet“.
2. Nur das Testevent (später das echte Event) freigeben. Recht: **Bestellungen ansehen**. Sonst nichts.
3. Reiter *API-Tokens* → Token erstellen → als `PRETIX_TOKEN` in Netlify eintragen.

**Webhook**
1. *Veranstalter → Webhooks → Neuen Webhook erstellen*.
2. Ziel-URL: `https://DEINE-SEITE.netlify.app/api/webhook?key=DEIN_WEBHOOK_KEY`
3. Nur das Testevent auswählen.
4. Aktionen: **Ticket eingecheckt** und **Check-in zurückgenommen** (`pretix.event.checkin`, `pretix.event.checkin.reverted`).
5. Speichern. Im Webhook siehst du später ein Protokoll, ob die Meldungen ankommen (Antwort 200 = gut, 401 = Key falsch).

**Scanner**
1. pretixSCAN aufs Handy laden.
2. *Veranstalter → Geräte → Gerät hinzufügen* → QR-Code mit der App scannen.
3. Testevent + Check-in-Liste wählen, in der App Testmodus aktivieren.

## 4. Nummernliste hochladen

1. Tablet: `https://DEINE-SEITE.netlify.app` öffnen, PIN eingeben.
2. *Einstellungen → Nummernliste hochladen* → eure durchnummerierte Bestellübersicht (Excel oder CSV).
3. Spalten prüfen (Laufende Nr., Bestellnummer, Name, Anzahl Tickets) → *Liste speichern*.

Bei mehreren Zeilen pro Bestellung (eine Zeile pro Ticket) wird automatisch zusammengefasst.

## 5. Testen

- Ohne pretix: *Einstellungen → Testscan* mit einer Bestellnummer.
- Mit pretix: Ticket aus einer Testbestellung mit pretixSCAN scannen → nach 1–2 Sekunden steht der Umschlag auf dem Tablet.
- Oben *Ton an* antippen, dann piept es bei jedem neuen Umschlag.
- Nach dem Testen: *Einstellungen → Alles zurücksetzen*.

## Fürs echte Event

- Im Team und im Webhook statt des Testevents das echte Event auswählen.
- Finale Nummernliste hochladen.
- Internet an der Kasse sicherstellen (Hotspot). Ohne Netz scannt pretixSCAN offline weiter, die Meldungen ans Tablet kommen dann aber erst, wenn wieder Netz da ist.
- Nach dem Event: Token im pretix-Team löschen.

## Anzeige

- **Großes Feld links:** der neueste offene Umschlag. „Ausgegeben“ antippen, wenn er übergeben wurde.
- **Warteschlange rechts:** weitere offene Umschläge.
- **Live-Ticker:** jeder einzelne Scan inkl. zurückgenommener Check-ins.
- **Rotes „?“:** Bestellnummer steht nicht in der Liste – Umschlag über die Bestellnummer suchen.
- Versehentlich abgehakt? *Einstellungen → Bereits ausgegeben → Zurückholen*.

## Tombola (Reiter „Tombola“)

1. In pretix im Event eine zweite Check-in-Liste anlegen und **„Tombola“** nennen (*Event → Check-in → Check-in-Listen → Neue Liste*). Alle Produkte auswählen.
2. Das pretix-Team braucht das Recht **Bestellungen ansehen** (hat es schon). Der Webhook muss nicht geändert werden.
3. Auf der Seite im Reiter **Tombola** die Gewinne eintragen (Name, optional Anzahl) – oder per **Excel hochladen** alle auf einmal: erste Spalte „Gewinn“, zweite Spalte „Anzahl“. Gleichnamige Gewinne werden zusammengeführt. Über das Suchfeld findest du einen Gewinn schnell; bei genau einem Treffer schaltet Enter ihn scharf.
4. Ablauf: Gewinn antippen → in pretixSCAN die Liste **Tombola** wählen → Ticket des Gewinners scannen → Name, E-Mail und Gewinn erscheinen und landen in der Gewinnerliste.
5. Wird ohne angetippten Gewinn gescannt, steht der Gewinner mit „Gewinn fehlt“ in der Liste und kann nachträglich zugeordnet werden.
6. Nach dem Event: **CSV exportieren** (öffnet sich in Excel), dann unter *Einstellungen → Gewinner löschen*.

Unter *Einstellungen → 4. Check-in-Listen* siehst du, welche Liste wohin gehört. Listen mit „Tombola“ im Namen werden automatisch erkannt; sonst dort umstellen.

## Goodies (Reiter „Goodies“)

1. In pretix eine Check-in-Liste anlegen, deren Name „Goodie“ enthält (z. B. „Goodie + Gewinn“). Sie wird automatisch erkannt; sonst unter *Einstellungen → 4. Check-in-Listen* auf „Goodie + Gewinn“ stellen.
2. Im Reiter **Goodies** → **Excel hochladen**: Spalte A Nummer, Spalte B Gewinn (leer = kein Zusatzgewinn). Danach fragt die Seite, von 1 bis wie viel gezogen wird (Anzahl Teilnehmer/Lose).
3. Ablauf: Ticket auf der Goodie-Liste scannen → die Seite zieht eine Zufallszahl (jede Nummer nur einmal) → zeigt Gewinn oder „Leider kein Zusatzgewinn – Goodie-Bag ausgeben“.
4. Wird dasselbe Ticket nochmal gescannt, erscheint das alte Ergebnis – keine zweite Ziehung. Wird der Check-in in pretix zurückgenommen, kommt die Nummer zurück in die Trommel.
5. Nach dem Event: **CSV exportieren**, dann *Einstellungen → Goodie-Ziehungen löschen*.

## Suche und „Fehlt noch“ (Reiter „Umschläge“)

- Suchfeld rechts: Name, Teilnehmer, Bestellnummer oder Umschlag-Nr. eintippen → Umschlag und Status erscheinen.
- „Fehlt noch“ zeigt alle Bestellungen, die noch nicht eingecheckt sind; „Alle“ zeigt die komplette Nummernliste mit Status.
- „Ohne Scan ausgeben“: für Gäste ohne Ticket oder wenn Scanner/Netz ausfällt.
- Tipp: In der Nummernliste eine Spalte „Teilnehmer“ mitgeben, dann findet die Suche auch Mitfahrer.

## Bühne (Reiter „Bühne“)

- „Testziehung“: zieht ohne Check-ins aus der Nummernliste (oder Beispielnamen), zählt nicht als echte Ziehung.
- Für Beamer/TV: Seite mit `…/#buehne` öffnen, „Vollbild“ (oder Doppelklick auf die Bühne), oben „Ton an“.
- Gewinn wählen (aus der Tombola-Liste oder frei eintippen) → „Namen ziehen“ oder Leertaste.
- Gezogen wird aus allen auf der Eingangsliste eingecheckten Gästen; angezeigt werden nur Vorname + Initial.
- Drei Animationen: Pisten-Walze, Bergfahrt (Gondeln), Anzeigetafel – standardmäßig abwechselnd.
- Ziehung startet auf allen Geräten gleichzeitig: Tablet bedienen, Beamer zeigt.
- „Gewinn in Tombola bereitlegen“: Wenn der Gewinner am Stand ist, Ticket auf der Tombola-Liste scannen → Name/E-Mail landen in der Gewinnerliste.
