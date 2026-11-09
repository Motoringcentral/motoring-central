"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeNext } from "@/lib/session";
import { CUSTOMER_TERMS_VERSION } from "@/lib/terms";

export type FormState = { error?: string; fields?: Record<string, string> };

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s]{9,14}$/, "Enter a valid UK mobile number."),
  postcode: z.string().trim().regex(UK_POSTCODE, "Enter a valid UK postcode."),
  password: z.string().min(8, "Your password needs at least 8 characters."),
  terms: z.literal("on", { error: "Tick to accept the terms and conditions." }),
  reminders: z.literal("on").optional(),
});

function fieldsOf(formData: FormData) {
  // Echo back what was typed (never the password) so the form isn't wiped.
  const out: Record<string, string> = {};
  for (const key of ["name", "email", "phone", "postcode"]) out[key] = String(formData.get(key) ?? "");
  return out;
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = RegisterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: fieldsOf(formData) };
  const d = parsed.data;

  try {
    const res = await auth.api.signUpEmail({
      body: {
        name: d.name,
        email: d.email,
        password: d.password,
        phone: d.phone,
        postcode: d.postcode.toUpperCase(),
        remindersOptIn: d.reminders === "on",
      },
      headers: await headers(),
    });
    await db.termsAcceptance.create({
      data: { userId: res.user.id, document: "customer-terms", version: CUSTOMER_TERMS_VERSION },
    });
  } catch (e) {
    const message = isAPIError(e) ? e.body?.message : undefined;
    return { error: message ?? "We couldn't create your account. Please try again.", fields: fieldsOf(formData) };
  }

  redirect(safeNext(formData.get("next")));
}

const LoginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function logIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  const fields = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch {
    return { error: "That email and password don't match an account.", fields };
  }

  redirect(safeNext(formData.get("next")));
}

export async function logOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
