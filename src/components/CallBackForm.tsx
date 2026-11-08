"use client";

import { useState } from "react";

export function CallBackForm() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").replace(/[\s()-]/g, "");
    if (!name) return setError("Please enter your name.");
    if (!/^(\+44|0)\d{9,10}$/.test(phone)) return setError("Please enter a UK phone number, for example 07700 900123.");
    setError("");
    // Saving and emailing call-back requests is added in a later phase.
    setSent(`Thanks, ${name}. Call-back requests aren't switched on yet. This is the test version of the site.`);
    e.currentTarget.reset();
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="form-two">
        <div>
          <label htmlFor="cb-n">Your name</label>
          <input type="text" id="cb-n" name="name" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="cb-p">Phone number</label>
          <input type="tel" id="cb-p" name="phone" autoComplete="tel" />
        </div>
      </div>
      <label htmlFor="cb-t">Best time to call</label>
      <select id="cb-t" name="time">
        <option>As soon as possible</option>
        <option>Morning</option>
        <option>Afternoon</option>
        <option>Evening</option>
      </select>
      <label htmlFor="cb-m">What is it about? (optional)</label>
      <input type="text" id="cb-m" name="message" placeholder="e.g. a question about a booking" />
      <p className="err" role="alert">
        {error}
      </p>
      <button className="btn block" type="submit">
        Request a call back
      </button>
      {sent && (
        <p className="okmsg" role="status">
          {sent}
        </p>
      )}
    </form>
  );
}
