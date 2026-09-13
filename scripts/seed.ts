import { loadEnv } from "./env";
loadEnv();

import { getDb } from "../src/lib/db";

// Just opening the DB triggers migrations + initial seeding (4 teams, gameweek 1,
// and a default "admin" account using ADMIN_PASSWORD from the environment).
const db = getDb();
const teams = db.prepare("SELECT name, captain FROM teams").all();
const admins = db.prepare("SELECT username FROM admin_users").all();

console.log("Database ready.");
console.log("Teams:", teams);
console.log("Admin accounts:", admins);
