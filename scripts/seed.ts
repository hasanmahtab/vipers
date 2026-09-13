import { loadEnv } from "./env";
loadEnv();

import { all } from "../src/lib/db";

// Just touching the database triggers migrations + initial seeding (4 teams,
// the 32 registered players, gameweek 1, and a default "admin" account using
// ADMIN_PASSWORD from the environment).
async function main() {
  const teams = await all("SELECT name, captain FROM teams");
  const admins = await all("SELECT username FROM admin_users");
  const players = await all("SELECT COUNT(*) as c FROM players");

  console.log("Database ready.");
  console.log("Teams:", teams);
  console.log("Admin accounts:", admins);
  console.log("Players seeded:", players[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
