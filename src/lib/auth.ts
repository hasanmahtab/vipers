import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { signToken, verifyToken } from "./token";

const SESSION_COOKIE = "vipers_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Copy .env.example to .env.local and set a random value."
    );
  }
  return secret;
}

interface SessionPayload {
  uid: number;
  username: string;
  exp: number;
}

export interface AdminUser {
  id: number;
  username: string;
  display_name: string | null;
}

export function verifyLogin(username: string, password: string): AdminUser | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id, username, password_hash, display_name FROM admin_users WHERE username = ?")
    .get(username) as
    | { id: number; username: string; password_hash: string; display_name: string | null }
    | undefined;
  if (!row) return null;
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return null;
  return { id: row.id, username: row.username, display_name: row.display_name };
}

export async function createSessionToken(user: AdminUser): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return signToken({ uid: user.id, username: user.username, exp } satisfies SessionPayload, getSecret());
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getSessionMaxAge() {
  return SESSION_TTL_SECONDS;
}

export async function getCurrentAdmin(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken<SessionPayload>(token, getSecret());
}
