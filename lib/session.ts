"use server";
import { cookies } from "next/headers";
import { encrypt, decrypt } from "./encryption";

export interface SessionData {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

const SESSION_COOKIE_NAME = "user_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export async function signOut() {
  const cookieStore = await cookies();
  clearSession();

  // Clear all cookies
  cookieStore.getAll().forEach((cookie) => {
    cookieStore.delete(cookie.name);
  });

  // Explicitly clear specific cookies
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
  cookieStore.delete("user_session");
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const encryptedSession = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!encryptedSession) {
    return null;
  }

  try {
    const decryptedSession = await decrypt(encryptedSession);
    return JSON.parse(decryptedSession) as SessionData;
  } catch (error) {
    console.error("Failed to decrypt session:", error);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
