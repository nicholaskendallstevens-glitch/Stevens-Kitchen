# Stevens Kitchen

Private Rezept-, Wochenplan- und Einkaufslisten-App für zwei Personen.
Next.js (PWA) auf Vercel, Daten in Supabase, optional Claude für Foto-/Text-Import.
**Kosten: 0 CHF** (plus ein paar Rappen pro Monat, wenn du den KI-Import nutzt).

## Was die App kann

| Bereich | Funktionen |
|---|---|
| **Rezepte** | Import per Link von beliebigen Rezeptseiten (Fooby, Swissmilk, Betty Bossi, BBC Good Food, Jamie Oliver, Chefkoch, die meisten Blogs), ohne Export-Funktion der Seite, per Foto (Kochbuchseite, handgeschriebene Karte, Screenshot), per eingefügtem Text; optional ins Englische übersetzen. Von Hand erfassen; Foto vom eigenen Gericht direkt auf der Rezeptseite aufnehmen, Tags, Favoriten, Notizen, Duplikat-Warnung |
| **Schweizer Einheiten** | g/kg, ml/dl/l, TL/EL. Cups/oz/lb/pints werden umgerechnet (Mehl, Zucker usw. in Gramm), °F und UK-„gas mark“ → °C in den Arbeitsschritten |
| **Wochenplan** | Mo–So, Mittag/Abend, Portionen pro Mahlzeit, Freitext („Reste“, „Auswärts“), „Dinners vorschlagen“ (Favoriten, die ihr länger nicht gekocht habt), „Letzte Woche kopieren“, verschieben, als gekocht markieren. Sonntags öffnet die App automatisch die kommende Woche |
| **Einkaufsliste** | Pro Woche statt pro Rezept: skaliert auf die geplanten Portionen, fasst gleiche Zutaten zusammen (Zwiebel + Zwiebeln, 2 dl + 150 ml = 3.5 dl), sortiert nach Gängen für **Migros, Coop, Lidl, Aldi, Denner** (Reihenfolge anpassbar), Vorrat („Salz, Öl…“) separat eingeklappt, eigene Artikel („2 l Milch“, „Windeln“), Live-Abgleich zwischen beiden Handys, offline lesbar, per WhatsApp teilen. Wird ein Artikel einem anderen Gang zugeordnet, merkt sich die App das |
| **Kochmodus** | Bildschirm bleibt an, grosse Schritte, Timer werden aus dem Text erkannt („10 Minuten“), Zutaten skaliert |
| **Sonstiges** | Verlauf („3× gekocht, zuletzt vor 12 Tagen“), Sortierung „länger nicht gekocht“, Backup als JSON, Dark Mode |

---

## Einrichtung (ca. 20 Minuten)

### 0. Voraussetzungen
Kostenlose Konten bei GitHub, Supabase und Vercel (bei Vercel mit GitHub anmelden). Für Schritt 2 entweder die GitHub-CLI (`gh`) oder GitHub Desktop.

### 1. Supabase (Datenbank + Login)
1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt anlegen. Region: Zürich, falls angeboten, sonst Frankfurt.
2. **SQL Editor → New query** → Inhalt von `supabase/schema.sql` einfügen → **Run**.
3. **Authentication → Sign In / Providers → Email**: „Allow new users to sign up“ **ausschalten**.
4. **Authentication → Users → Add user → Create new user**: eure beiden E-Mails mit Passwort anlegen, „Auto Confirm User“ anhaken.
5. **Project Settings → API**: `Project URL` und `anon public` Key kopieren.

### 2. Code auf GitHub
```bash
cd stevens-kitchen
git init && git add . && git commit -m "Stevens Kitchen"
gh repo create stevens-kitchen --private --source=. --push
```

### 3. Vercel
1. Auf [vercel.com](https://vercel.com) → **Add New → Project** → das Repo importieren.
2. Unter **Environment Variables** (siehe `.env.example`) eintragen:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ALLOWED_EMAILS` = eure zwei E-Mails, durch Komma getrennt
   - `NEXT_PUBLIC_APP_NAME` = Name der App (Standard „Stevens Kitchen“)
   - optional `ANTHROPIC_API_KEY` (siehe unten)
3. **Deploy**. Ihr erhaltet eine Adresse wie `stevens-kitchen.vercel.app`, eine eigene Domain braucht es nicht.
4. Ein Cron-Job (`vercel.json`) ruft alle 3 Tage `/api/keepalive` auf, damit Supabase Free nicht nach 7 Tagen ohne Nutzung pausiert. Er läuft auf den Servern von Vercel, nicht auf euren Handys.

### 4. iPhone
- In **Safari** die Vercel-Adresse öffnen → Teilen → **Zum Home-Bildschirm**. Die App startet danach im Vollbild mit eigenem Icon.
- Einmal anmelden, danach bleibt die Anmeldung bestehen.

### 5. Kurzbefehl: Rezepte direkt aus Safari speichern (funktioniert auf jeder Seite)
Manche Foodblogs (z.B. natashaskitchen.com) blockieren Server mit Bot-Schutz („The site blocks apps…“). Dieser Kurzbefehl umgeht das ehrlich: Er nimmt die Seite, die du in Safari schon offen hast.

1. Einmalig: **Einstellungen → Apps → Kurzbefehle → Erweitert → „Skripte ausführen erlauben“** einschalten.
2. In der App: **Settings → „Copy shortcut script“** tippen (kopiert das Skript mit eurer Adresse).
3. App **Kurzbefehle** → **+** → Name „Zu Stevens Kitchen“.
4. Unten **ⓘ → Im Share-Sheet anzeigen** einschalten; bei „Empfängt“ nur **Safari-Webseiten** lassen.
5. Aktion **„JavaScript auf Webseite ausführen“** hinzufügen → den Beispielcode löschen → kopiertes Skript einfügen.
6. Aktion **„URLs öffnen“** hinzufügen (Eingabe: Ergebnis von JavaScript) → **Fertig**.
7. Einmalig in **Safari** die App-Adresse öffnen und anmelden (Safari und Homescreen-App haben getrennte Logins).

Danach: Rezept in Safari öffnen → **Teilen → Zu Stevens Kitchen** → Rezept erscheint zum Prüfen & Speichern. Beim ersten Mal fragt iOS, ob der Kurzbefehl auf die Seite zugreifen darf → „Immer erlauben“.

### 6. KI-Import (Foto, Text, Seiten ohne Rezeptdaten, Übersetzung)
- Auf [console.anthropic.com](https://console.anthropic.com) einen API-Key erstellen und ein kleines Guthaben laden (5 USD reichen sehr lange).
- In Vercel `ANTHROPIC_API_KEY` setzen und neu deployen. Das Modell lässt sich über `ANTHROPIC_MODEL` ändern (Standard `claude-haiku-5-5`, günstig und schnell).
- Links von Seiten mit strukturierten Rezeptdaten (die meisten) werden **ohne KI** gelesen und kosten nichts.

---

## Lokal entwickeln
```bash
cp .env.example .env.local   # Werte eintragen
npm install
npm run dev                  # http://localhost:3000
npm test                     # Parser, Einheiten, Zusammenfassung, Import
```

## Aufbau
```
src/lib/ingredients.ts   Zutaten-Parser DE/EN/FR → Menge, Einheit, Name, Notiz
src/lib/units.ts         Schweizer Einheiten, Umrechnung, Formatierung (2.5 dl, 1½ EL)
src/lib/categories.ts    Gang-Zuordnung (~900 Stichwörter DE/EN/FR) + Namensnormalisierung
src/lib/shopping.ts      Wochenliste: skalieren, zusammenfassen, Vorrat
src/lib/stores.ts        Gang-Reihenfolge Migros/Coop/Lidl/Aldi/Denner
src/lib/import/          schema.org-JSON-LD-Parser + Claude (Seite/Text/Foto/Übersetzung)
src/app/                 Seiten: plan, recipes, list, settings, login, api/import
supabase/schema.sql      Tabellen, RLS, Realtime, Speicher-Bucket
```

Sicherheit: Registrierung ist deaktiviert, die Middleware lässt nur `ALLOWED_EMAILS` herein, und RLS erlaubt Zugriff nur angemeldeten Benutzern.
