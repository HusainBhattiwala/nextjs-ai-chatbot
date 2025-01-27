"use server";

import { getSession, signOut } from "@/lib/session";
import { encrypt } from "@/lib/encryption";
import { cookies } from "next/headers";

interface SerializableResponse {
  data: any;
  status: number;
  ok: boolean;
  statusText: string;
}

async function updateSessionCookies(session: any) {
  const encryptedSession = await encrypt(JSON.stringify(session));

  const cookieStore = await cookies();

  cookieStore.set("user_session", encryptedSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  cookieStore.set("access_token", session.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  cookieStore.set("refresh_token", session.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

export async function customFetch(
  input: RequestInfo,
  init?: RequestInit
): Promise<SerializableResponse> {
  // Get the token from cookies
  const cookieStore = await cookies();
  const access_token = cookieStore.get("access_token")?.value;

  // Create headers with the token
  const headers = new Headers(init?.headers || {});
  if (access_token) {
    headers.set("token", access_token);
  }
  headers.set("entity", "User");

  // Only set Content-Type to application/json if we're not sending FormData
  if (!(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response = await fetch(input, {
    ...init,
    headers,
  });

  let responseData: any;
  try {
    responseData = await response.json();
  } catch (e) {
    responseData = null;
  }

  // Rest of the function remains the same...
  // Handle 401 Unauthorized
  if (response.status === 401) {
    const session = await getSession();

    if (session?.refreshToken) {
      try {
        const refreshResponse = await fetch(
          "http://127.0.0.1:8000/api/v1/token/refresh",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              refresh: session.refreshToken,
              access: session.accessToken,
            }),
          }
        );

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();

          const updatedSession = {
            ...session,
            accessToken: refreshData.access,
            refreshToken: refreshData.refresh,
          };

          await updateSessionCookies(updatedSession);

          headers.set("token", refreshData.access);
          // Don't override Content-Type if it's FormData
          if (!(init?.body instanceof FormData)) {
            headers.set("Content-Type", "application/json");
          }

          response = await fetch(input, {
            ...init,
            headers,
          });

          try {
            responseData = await response.json();
          } catch (e) {
            responseData = null;
          }
        } else {
          signOut();
          return {
            data: { error: "Authentication failed" },
            status: 401,
            ok: false,
            statusText: "Unauthorized",
          };
        }
      } catch (error) {
        console.error("Failed to refresh token:", error);
        signOut();
        return {
          data: { error: "Token refresh failed" },
          status: 401,
          ok: false,
          statusText: "Unauthorized",
        };
      }
    } else {
      signOut();
      return {
        data: { error: "No refresh token available" },
        status: 401,
        ok: false,
        statusText: "Unauthorized",
      };
    }
  }

  return {
    data: responseData,
    status: response.status,
    ok: response.ok,
    statusText: response.statusText,
  };
}
