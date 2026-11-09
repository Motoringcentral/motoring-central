import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/account/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-page px-4 pt-6">
      <h1 className="mb-4 text-[1.75rem] leading-tight font-extrabold">Log in</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
