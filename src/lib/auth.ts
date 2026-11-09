import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "CUSTOMER", input: false },
      phone: { type: "string", required: false },
      postcode: { type: "string", required: false },
      remindersOptIn: { type: "boolean", defaultValue: false },
    },
  },
  // Must stay last so server actions can set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
