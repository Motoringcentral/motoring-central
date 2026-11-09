import type { InputHTMLAttributes, ReactNode } from "react";

export const INPUT =
  "w-full rounded-[10px] border-2 border-line bg-bg px-3 py-[11px] text-ink placeholder:text-muted/70 focus-visible:outline-brand";

export function Field({
  label,
  name,
  hint,
  ...props
}: { label: string; name: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="mt-3 mb-1 block text-[.9rem] font-semibold">
        {label}
      </label>
      <input id={name} name={name} className={INPUT} {...props} />
      {hint && <p className="mt-1 text-[.8rem] text-muted">{hint}</p>}
    </div>
  );
}

export function FormError({ children }: { children?: string }) {
  return (
    <p role="alert" className="mt-3 text-[.88rem] font-semibold text-err empty:hidden">
      {children ?? ""}
    </p>
  );
}
