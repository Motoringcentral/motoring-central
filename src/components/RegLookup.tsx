"use client";

import { useState } from "react";

// UK number plate check: current (AB12 CDE), older prefix/suffix and dateless formats.
const UK_REG =
  /^([A-Z]{2}[0-9]{2}[A-Z]{3}|[A-Z][0-9]{1,3}[A-Z]{3}|[A-Z]{3}[0-9]{1,3}[A-Z]|[0-9]{1,4}[A-Z]{1,3}|[A-Z]{1,3}[0-9]{1,4})$/;

export function RegLookup() {
  const [reg, setReg] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = reg.replace(/\s+/g, "").toUpperCase();
    setDone("");
    if (!clean) {
      setError("Enter your registration, for example AB12 CDE.");
      return;
    }
    if (!UK_REG.test(clean)) {
      setError("That doesn't look like a UK registration. Check it and try again.");
      return;
    }
    setError("");
    // The real lookup (DVLA) is added in Phase 4.
    setDone(`Thanks. Instant prices for ${reg.trim().replace(/\s+/g, " ")} are coming soon. For now, call us and we'll help you book.`);
  }

  return (
    <form className="card lift" onSubmit={onSubmit} noValidate>
      <label htmlFor="reg" className="field-label">
        Registration
      </label>
      <div className="reg-row">
        <input
          id="reg"
          className="plate"
          maxLength={8}
          placeholder="AB12 CDE"
          autoComplete="off"
          value={reg}
          onChange={(e) => setReg(e.target.value.toUpperCase())}
          aria-describedby="reg-err"
        />
        <button className="btn" type="submit">
          Find my car
        </button>
      </div>
      <p className="err" id="reg-err" role="alert">
        {error}
      </p>
      {done && (
        <p className="okmsg" role="status">
          {done}
        </p>
      )}
      <p className="small muted" style={{ margin: "6px 0 0" }}>
        Free check, no sign-up needed. See prices from local partners, then register free for your exact price.
      </p>
    </form>
  );
}
