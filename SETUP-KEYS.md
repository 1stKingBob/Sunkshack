# Weave — API key setup

Everything goes in one file: **`.env.local`** in the project root (next to `package.json`).
It already has your Gemini key. Add the three community lines below it.

**After any edit to `.env.local`, stop the dev server (Ctrl+C) and run `npm run dev` again.**
Vite only reads env vars at startup — this is the single most common reason "the key didn't work".

---

## 1. Google Maps

Console: <https://console.cloud.google.com>

1. **Create a project.** Top-left project dropdown → *New Project* → call it `weave` → Create,
   then make sure it's the selected project.

2. **Turn on billing.** *Billing* → *Link a billing account* → add a card.
   Maps refuses to serve requests without it even on the free tier. You are not charged;
   Google gives a monthly free allowance far above anything a demo uses.

3. **Enable two APIs.** *APIs & Services* → *Library*, search and Enable each:
   - **Maps JavaScript API**
   - **Places API (New)** ← the one with **(New)** in the name.

   > Enable the *(New)* one. Google froze the old Places API on 1 March 2025 and it can no
   > longer be switched on for projects created after that date, so on a project you make
   > today the old one either isn't listed or won't work. The app calls the new API first and
   > only falls back to the old one for projects that still have it.

4. **Make the key.** *APIs & Services* → *Credentials* → *Create credentials* → *API key* → copy it.

5. **Restrict it** (optional, 30 seconds, worth it because this key ships in the browser bundle).
   Click the key, then:
   - *Application restrictions* → **Websites** → Add these two entries:
     ```
     http://localhost:5173/*
     https://your-app.vercel.app/*
     ```
     **If you skip `localhost:5173` the map will not load on your own laptop** — you'll get the
     "The map could not load" panel.
   - *API restrictions* → *Restrict key* → tick **Maps JavaScript API** and **Places API (New)**.

   Restriction changes can take a couple of minutes to take effect. If it fails right after
   saving, wait and hard-refresh before changing anything else.

---

## 2. Supabase

Console: <https://supabase.com/dashboard>

1. **New project.** Sign in with GitHub → *New project* → name `weave`, region **Sydney**
   (nearest = fastest for the demo), set a database password (you won't need it again), Create.
   It takes ~2 minutes to provision.

2. **Create the tables.** Left sidebar → *SQL Editor* → *New query*.
   Open `supabase/schema.sql` from this repo, copy the **whole file**, paste it in, press **Run**.
   You should see "Success. No rows returned." That creates `buildings`,
   `accessibility_reports`, the `building_scores` view, and the row-level-security policies.

   Check it worked: *Table Editor* should now list `buildings` and `accessibility_reports`.

3. **Copy the keys.** *Project Settings* (gear, bottom-left) → *API*:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Project API keys → `anon` `public`** → `VITE_SUPABASE_ANON_KEY`

   > Take the **anon / public** key, never the `service_role` one. The anon key is meant to be
   > in the browser and is fenced in by the RLS policies the schema creates. The service_role
   > key bypasses RLS entirely — anything shipped with it can read and delete your whole
   > database.

---

## 3. Paste into `.env.local`

Append these three lines (keep your existing `GEMINI_API_KEY` line above them):

```
VITE_GOOGLE_MAPS_API_KEY=AIza...
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

No quotes, no spaces around `=`. The `VITE_` prefix is required — without it Vite won't expose
the value to the browser and the app will behave as if the key is missing.

Then:

```powershell
# Ctrl+C to stop the server first
npm run dev
```

---

## 4. Check it worked

Open the app → **Community**.

| What you see | What it means |
|---|---|
| Search box + live Google map | Both keys are live. |
| A list of sample places, no map | Maps key missing or not picked up. `.env.local` in the wrong folder, no `VITE_` prefix, or the server wasn't restarted. |
| Map loads, yellow "Supabase is not configured" bar | Maps is fine; the two Supabase lines are missing or misspelled. |
| "The map could not load" panel | Key is wrong, billing is off, an API isn't enabled, or the referrer restriction is missing `localhost:5173`. The panel says which. |
| Map loads but searching errors | Almost always **Places API (New)** not enabled. The error text names the API. |

**End-to-end test:** Community → search `Fisher Library` → click a result → back to Dashboard →
run a room check → *Care Pass* → *Publish to community* → return to the map and the pin should
now carry a score.

---

## Note before you demo

`supabase/schema.sql` deliberately leaves RLS open — anyone with the anon key can post a score
for any building. That's the right call for a 24-hour build with no auth, and the comment at the
top of the file says so. Worth saying out loud to the judges before they ask: it's a known,
deliberate trade-off with a named fix (auth + ownership checks), not an oversight.
