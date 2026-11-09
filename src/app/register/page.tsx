import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/account/register-form";

export const metadata: Metadata = { title: "Register free" };

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-page px-4 pt-6">
      <h1 className="mb-1.5 text-[1.75rem] leading-tight font-extrabold">Register free</h1>
      <p className="mb-4 text-muted">
        Get a full check on your vehicle and fixed prices from checked local partners. It takes a minute.
      </p>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
