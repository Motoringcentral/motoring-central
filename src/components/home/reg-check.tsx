"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { checkReg, type RegCheckState } from "@/app/actions/vehicle";
import { PICK_SERVICE_EVENT, type PickServiceDetail } from "@/lib/services";

const SAMPLE_REGS = ["LM19 XYZ", "BD66 TTR", "KS21 EVO"];

export function RegCheck() {
  const [state, action, pending] = useActionState<RegCheckState, FormData>(checkReg, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<PickServiceDetail | null>(null);

  // A service tile elsewhere on the page sends the driver here to enter their reg.
  useEffect(() => {
    function onPick(e: Event) {
      setPicked((e as CustomEvent<PickServiceDetail>).detail);
      const input = inputRef.current;
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus({ preventScroll: true });
    }
    window.addEventListener(PICK_SERVICE_EVENT, onPick);
    return () => window.removeEventListener(PICK_SERVICE_EVENT, onPick);
  }, []);

  function trySample(reg: string) {
    if (!inputRef.current) return;
    inputRef.current.value = reg;
    formRef.current?.requestSubmit();
  }

  return (
    <div id="reg" className="card relative -mt-9 shadow-lift">
      <form ref={formRef} action={action}>
        {picked && <input type="hidden" name="mode" value={picked.mode} />}
        <label htmlFor="reg-input" className="text-[.9rem] font-semibold">
          Registration
        </label>
        <div className="mt-1 flex gap-2">
          <input
            ref={inputRef}
            id="reg-input"
            name="reg"
            maxLength={8}
            placeholder="AB12 CDE"
            autoComplete="off"
            // React resets the form after the action runs, so restore what was typed.
            defaultValue={state.status === "error" ? state.reg : undefined}
            aria-invalid={state.status === "error"}
            aria-describedby="reg-error"
            className="min-w-0 flex-1 rounded-[10px] border-2 border-[#c9a21c] bg-plate p-2.5 text-center text-[1.3rem] font-extrabold tracking-[.12em] text-[#241b00] uppercase placeholder:text-[#241b00]/45"
          />
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Checking…" : "Find my car"}
          </button>
        </div>
      </form>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[.85rem] text-muted">
        Try:
        {SAMPLE_REGS.map((reg) => (
          <button
            key={reg}
            type="button"
            onClick={() => trySample(reg)}
            className="cursor-pointer rounded-full border border-line bg-bg px-2.5 py-0.5 font-semibold tracking-[.06em] text-ink"
          >
            {reg}
          </button>
        ))}
      </div>

      {picked && (
        <p role="status" className="mt-2 font-bold">
          Enter your reg to book {picked.label}.
        </p>
      )}

      <p id="reg-error" role="alert" className="mt-2 text-[.88rem] font-semibold text-err empty:hidden">
        {state.status === "error" ? state.message : ""}
      </p>

      <p className="mt-2 text-[.82rem] text-muted">
        Free check, no sign-up needed. See prices from local partners, then register free for your exact price.
      </p>
    </div>
  );
}
