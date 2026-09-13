import { loadEnv } from "./env";
loadEnv();

import bcrypt from "bcryptjs";
import { run } from "../src/lib/db";

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

async function main() {
  const hash = bcrypt.hashSync(password, 10);

  try {
    await run("INSERT INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)", [
      username.toLowerCase(),
      hash,
      displayName || null,
    ]);
    console.log(`Admin account "${username}" created.`);
  } catch (err: any) {
    if (String(err.message).includes("UNIQUE")) {
      await run("UPDATE admin_users SET password_hash = ? WHERE username = ?", [hash, username.toLowerCase()]);
      console.log(`Admin account "${username}" already existed — password updated.`);
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
