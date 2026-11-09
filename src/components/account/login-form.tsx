"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { type FormState, logIn } from "@/app/actions/account";
import { Field, FormError } from "@/components/forms";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [state, action, pending] = useActionState<FormState, FormData>(logIn, {});

  return (
    <form action={action} className="card">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <FormError>{state.error}</FormError>
      <button type="submit" className="btn mt-4 block w-full" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="mt-3 text-[.88rem] text-muted">
        New here?{" "}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-ink underline">
          Register free
        </Link>
      </p>
    </form>
  );
}
