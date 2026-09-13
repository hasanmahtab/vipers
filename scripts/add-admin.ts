import { loadEnv } from "./env";
loadEnv();

import bcrypt from "bcryptjs";
import { getDb } from "../src/lib/db";

// Usage: npm run add-admin -- <username> <password> ["Display Name"]
const [username, password, displayName] = process.argv.slice(2);

if (!username || !password) {
  console.error('Usage: npm run add-admin -- <username> <password> ["Display Name"]');
  process.exit(1);
}
if (password.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

const db = getDb();
const hash = bcrypt.hashSync(password, 10);

try {
  db.prepare(
    "INSERT INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)"
  ).run(username.toLowerCase(), hash, displayName || null);
  console.log(`Admin account "${username}" created.`);
} catch (err: any) {
  if (String(err.message).includes("UNIQUE")) {
    db.prepare("UPDATE admin_users SET password_hash = ? WHERE username = ?").run(
      hash,
      username.toLowerCase()
    );
    console.log(`Admin account "${username}" already existed — password updated.`);
  } else {
    throw err;
  }
}
