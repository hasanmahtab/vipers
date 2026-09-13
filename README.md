# Vipers Fantasy League

A free, mobile-friendly fantasy football web app for the Vipers soccer league —
4 teams, 8-player squads, an auction budget, and automated point scoring.

- **Public pages** (no login needed): weekly summary, league table, team
  squads, and a clickable page for every player with their full stats
  history.
- **Admin-only backend** (login required): enter match scores and who
  scored/assisted — clean sheets, appearance points, and the goals-conceded
  penalty are all calculated automatically. Also used to set up the auction
  results (players, prices, budgets) and manage gameweeks/fixtures.
- **Data** lives in a free hosted [Turso](https://turso.tech) database
  (SQLite-compatible) so the app can run on hosts with no persistent disk —
  including every truly free tier (Render free, Vercel, etc.) — and you never
  have to run anything on your own computer.

## Scoring rules (built in)

| Event | Points |
|---|---|
| Playing in a fixture | +2 |
| Clean sheet — Goalkeeper | +5 |
| Clean sheet — Defender | +5 |
| Clean sheet — Midfielder | +1 |
| Goal — Goalkeeper | +10 |
| Goal — Defender | +6 |
| Goal — Midfielder | +5 |
| Goal — Striker | +4 |
| Assist (any position) | +3 |
| Every 2 goals conceded (GK/DEF only) | −1 |

Blue cards (offensive tackle, 1 minute sit-out) are recorded for the record
but don't currently subtract points — tell us if you'd like a points penalty
added for those too.

**Budget**: every team starts an auction with £100M. Whatever's left over
after the auction rolls into the team's balance for the next transfer
window. After every match, the admin enters the score and the app
automatically adds money to both teams' balances: **+£4M** for a win,
**+£2M** each for a draw, **+£1M** for a loss.

## Getting started — no local install needed

You do **not** need Node.js, npm, or anything else installed on your own
computer. Everything — creating the database, deploying the site, adding
admin logins, drafting players, entering scores — is done through web pages
(Turso's dashboard, your host's dashboard, and the app itself). See
**Deploying for free** below for the exact steps.

If you *do* have Node.js 20+ available and want to run it on your own
machine (e.g. to test changes before they go live):

```bash
npm install
cp .env.example .env.local   # then edit ADMIN_PASSWORD, SESSION_SECRET, and the TURSO_* values
npm run seed                 # creates the database + the 4 teams + admin login
npm run dev                  # http://localhost:3000
```

Generate a good `SESSION_SECRET` with:

```bash
openssl rand -hex 32
```

Log in to `/admin` with username `admin` and the password you set as
`ADMIN_PASSWORD`. From the admin dashboard you can add more login accounts
(e.g. one per team captain) under **Admin Users**.

## Setting up the season

All 32 registered players (with last season's points, and the 4 captains
flagged) are already pre-loaded as an **undrafted player pool** the first
time the app starts — there was no need to re-type them.

1. **After the auction**, go to `/admin/players` → **Draft Pool**. For each
   player, pick their team, position, and auction price, then hit Draft.
   The squad shape (1 GK, 3 DEF, 3 MID, 1 FWD per team) is enforced
   automatically, so a mis-click is caught immediately. Made a mistake?
   "Undraft" a player from their team's squad card to send them back to the
   pool.
   - Signed someone who wasn't on the original list? Use **Add a New
     Player Directly** further down the same page.
   - Prefer a spreadsheet? **Bulk Import from CSV** still works with
     columns `team, name, position, price, last_season_points` — see
     [`data/players_template.csv`](./data/players_template.csv) for the
     exact format (team names must match exactly: Blackouts FC, Darkstar
     FC, Showstoppers, Goli Underdogs).
2. Go to `/admin/teams` and set each team's **starting budget** to whatever
   was left over after the auction.
3. Go to `/admin` to create **Gameweek 1** and add each fixture (which two
   teams are playing).
4. After a match, open that fixture's **Enter score**, type the final score,
   then for each of the 7 players who played: tick "Played" and enter their
   goals/assists (and blue cards, just for the record). Clean sheets, the
   goals-conceded penalty, and budget bonuses are all calculated the moment
   you hit save.

Everything else (home page, table, team pages, player pages) updates
automatically — just share the site link with the league.

## Deploying for free so everyone can use it

Everything below happens in a web browser — no installs, no command line.

### Step 1 — Create a free database on Turso

1. Go to [turso.tech](https://turso.tech) and sign up (free, no credit card).
2. From their dashboard, create a new database (any name, e.g. `vipers`).
3. Once it's created, find:
   - The **database URL** — looks like `libsql://vipers-yourname.turso.io`
   - An **auth token** — the dashboard has a "Create Token" / "Generate
     Token" button for the database
4. Keep both values handy for the next step.

### Step 2 — Deploy the app on Render

1. Push this repo to GitHub (already done if you're reading this from the
   repo).
2. Go to [render.com](https://render.com) and sign up (free, no credit card
   needed for this).
3. Click **New → Web Service** and connect this GitHub repo.
4. Fill in:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Under **Environment**, add these variables:
   - `ADMIN_PASSWORD` → a password for the first admin login
   - `SESSION_SECRET` → any long random string (40+ random characters)
   - `TURSO_DATABASE_URL` → the database URL from Step 1
   - `TURSO_AUTH_TOKEN` → the auth token from Step 1
6. Click **Deploy**. No disk needed — the database lives on Turso, not on
   Render, so the free tier is all you need.

A few minutes later you'll get a free link like
`https://vipers-fantasy.onrender.com` to share with the league. (Render's
free tier sleeps after inactivity and takes a few seconds to wake up on the
first visit after a quiet spell — that's normal and free.)

Vercel works exactly the same way (connect the repo, add the same four
environment variables, deploy) if you'd rather use that instead of Render —
either is genuinely free and needs no disk, since the data lives on Turso.

## Project structure

```
src/app/            Pages (home, teams, players, table, admin/*)
src/components/     Shared UI pieces (nav, cards, badges)
src/lib/db.ts       Turso (libSQL) connection + schema + first-run seeding
src/lib/scoring.ts  The points-calculation rules
src/lib/queries.ts  Read queries used by pages
src/lib/actions.ts  Server actions used by admin forms (writes)
src/lib/auth.ts     Login/session helpers
src/middleware.ts   Protects everything under /admin
scripts/seed.ts     One-off: create DB + default admin
scripts/add-admin.ts  CLI: add or reset an admin login
data/players_template.csv  Starter CSV for bulk-importing your squads
```

## What we still need from you

- The final auction results: which of the 32 registered players went to
  which team, in what position, and for how much (enter these in the Draft
  Pool as described above), plus each team's leftover budget.
- Whether blue cards should cost fantasy points (and how many), or stay
  informational only as they are now.
