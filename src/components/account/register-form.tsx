"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { type FormState, register } from "@/app/actions/account";
import { Field, FormError } from "@/components/forms";

export function RegisterForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [state, action, pending] = useActionState<FormState, FormData>(register, {});
  const f = state.fields ?? {};

  return (
    <form action={action} className="card">
      <input type="hidden" name="next" value={next} />
      <Field label="Full name" name="name" autoComplete="name" required defaultValue={f.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={f.email} />
      <Field label="Mobile number" name="phone" type="tel" autoComplete="tel" required defaultValue={f.phone} />
      <Field
        label="Postcode"
        name="postcode"
        autoComplete="postal-code"
        required
        defaultValue={f.postcode}
        className="uppercase"
        hint="Used to find partners near you."
      />
      <Field
        label="Create a password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="At least 8 characters."
      />

      <label className="mt-4 flex items-start gap-2 text-[.9rem]">
        <input type="checkbox" name="terms" required className="mt-1 size-[18px] flex-none accent-brand" />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="underline">
            terms and conditions
          </Link>
          . I understand Motoring Central introduces me to independent partners, who carry out the work and are
          responsible for it.
        </span>
      </label>
      <label className="mt-3 flex items-start gap-2 text-[.9rem]">
        <input type="checkbox" name="reminders" className="mt-1 size-[18px] flex-none accent-brand" />
        <span>Send me MOT and service reminders (optional).</span>
      </label>

      <FormError>{state.error}</FormError>
      <button type="submit" className="btn mt-4 block w-full" disabled={pending}>
        {pending ? "Creating your account…" : "Register free"}
      </button>
      <p className="mt-3 text-[.88rem] text-muted">
        Already registered?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-ink underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
