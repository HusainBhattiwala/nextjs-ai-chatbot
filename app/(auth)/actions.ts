"use server";

import { z } from "zod";
import { encrypt } from "@/lib/encryption";

import { createUser, getUser } from "@/lib/db/queries";

import { signIn } from "./auth";
import { cookies } from "next/headers";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const loginFormSchema = z.object({
  tenant_id: z.string(),
  email: z.string().email(),
  password: z.string(),
});

export type LoginActionState =
  | { status: "idle" | "in_progress" | "failed" | "invalid_data" }
  | {
      status: "success";
      tokens: {
        access_token: string;
        refresh_token: string;
      };
    };

const SESSION_COOKIE_NAME = "user_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = loginFormSchema.parse({
      tenant_id: formData.get("tenant_id"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    // console.log(validatedData);

    const response = await fetch(
      "http://127.0.0.1:8000/api/v1/token/access/user",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_id: validatedData.tenant_id,
          email: validatedData.email,
          password: validatedData.password,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      const cookieStore = await cookies();
      const sessionData = {
        userId: data.id,
        email: validatedData.email,
        accessToken: data.access,
        refreshToken: data.refresh,
      };

      const encryptedSession = await encrypt(JSON.stringify(sessionData));
      cookieStore.set(SESSION_COOKIE_NAME, encryptedSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: MAX_AGE,
        path: "/",
      });
      cookieStore.set("access_token", data.access, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
      cookieStore.set("refresh_token", data.refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      return {
        status: "success",
        tokens: {
          access_token: data.access,
          refresh_token: data.refresh,
        },
      };
    } else {
      return { status: "failed" };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export interface RegisterActionState {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
}

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: "user_exists" } as RegisterActionState;
    }
    await createUser(validatedData.email, validatedData.password);
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};
