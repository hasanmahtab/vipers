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
- **Data** lives in a single SQLite file (`data/vipers.db`) — nothing to
  configure, and it's easy to back up (just copy the file).

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

## Getting started (local)

Requires [Node.js](https://nodejs.org) 20 or later.

```bash
npm install
cp .env.example .env.local   # then edit ADMIN_PASSWORD and SESSION_SECRET
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

This app needs a small always-on Node server (not a static site) because of
the SQLite database, so a couple of good free options:

### Option A — Render (recommended, simplest)

1. Push this repo to GitHub.
2. On [Render](https://render.com), create a new **Web Service** from the
   repo.
3. Build command: `npm install && npm run build`
   Start command: `npm start`
4. Add environment variables `ADMIN_PASSWORD` and `SESSION_SECRET` (see
   above) and `DB_PATH=/data/vipers.db`.
5. Add a free **persistent disk** mounted at `/data` (Render → your service
   → Disks) so the database survives restarts/redeploys.
6. Deploy — Render gives you a free `https://your-app.onrender.com` link you
   can share with the league. (Free-tier services sleep after inactivity and
   take a few seconds to wake up on the first visit — that's normal.)

### Option B — Railway or Fly.io

Both work the same way: Node web service, build with `npm run build`, start
with `npm start`, and attach a small persistent volume for the `data/`
folder so the SQLite file isn't wiped on redeploy. Both have free/low-cost
tiers.

> Vercel is not recommended here — its serverless functions don't have a
> writable persistent disk, so the SQLite database wouldn't survive between
> requests. If you'd rather use Vercel, say so and we can swap the database
> for a free hosted Postgres (e.g. Neon) instead.

## Project structure

```
src/app/            Pages (home, teams, players, table, admin/*)
src/components/     Shared UI pieces (nav, cards, badges)
src/lib/db.ts       SQLite connection + schema + first-run seeding
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
