"use client";

// Pre-work vehicle inspection for partners (update TMC-UPD-20261115-A).
// The partner picks today's booking; job, partner, customer and vehicle details fill in and lock.
// Mileage is never filled from the booking: the partner reads it from the dashboard.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionBar, Banner, Card, Check, DamageDiagram, Field, FuelSlider, Modal, Photos, Seg, SignaturePad, TextArea,
  cx, fmtWhen, fuelLabel, nowLocal, styles as s, useDraft, useToast, type Damage, type Photo, type Signatures,
} from "./shared";
import { damageSection, finishPdf, hex, MUT, NAVY, photoPages, signatureSection, startPdf } from "./pdf";
import {
  BAD_ANSWERS, INSPECTION_LEGAL, INSPECTION_RECORDS_KEY, PARTNER_TYPES, QUICK_CHECKS, SAMPLE_BOOKINGS, SAMPLE_PARTNER,
  VEHICLE_LOCATIONS, saveRecord, type Booking,
} from "@/lib/inspections";

type Fields = Partial<Record<
  "job" | "when" | "partner" | "tech" | "vrm" | "mileage" | "make" | "colour" | "year" | "fuelT" | "gear" | "cname" | "cphone" | "notes",
  string
>>;
type State = {
  f: Fields;
  fuelPct: number | null;
  ptype: string | null;
  where: string | null;
  checks: Record<number, string | null>;
  dmg: Damage[];
  nodamage: boolean;
  photos: Photo[];
  sig: Signatures;
  absent: boolean;
  agree: boolean;
  booking: Booking | null;
  unlocked: boolean;
  manual: boolean;
};

const blank = (): State => ({
  f: { },
  fuelPct: null,
  ptype: null,
  where: null,
  checks: {},
  dmg: [],
  nodamage: false,
  photos: [],
  sig: {},
  absent: false,
  agree: false,
  booking: null,
  unlocked: false,
  manual: false,
});

// Which form field each booking value fills.
const FROM_BOOKING: [keyof Fields, (b: Booking) => string | undefined][] = [
  ["job", (b) => b.job],
  ["partner", () => SAMPLE_PARTNER.name],
  ["tech", () => SAMPLE_PARTNER.tech],
  ["vrm", (b) => b.vrm],
  ["make", (b) => b.make],
  ["colour", (b) => b.colour],
  ["year", (b) => b.year],
  ["fuelT", (b) => b.fuel],
  ["gear", (b) => b.gear],
  ["cname", (b) => b.cname],
  ["cphone", (b) => b.cphone],
];

const REQUIRED = [
  "Job number", "Partner name", "Technician name", "Registration", "Mileage", "Fuel level",
  'Damage marked (or "no damage" ticked)', "All quick checks", "At least 4 photos", "Technician signature",
  'Customer signature (or "not present")', "Agreement box",
];

function withBooking(b: Booking): State {
  const st = blank();
  for (const [k, get] of FROM_BOOKING) {
    const v = get(b);
    if (v) st.f[k] = v;
  }
  return { ...stampTime(st), booking: b, ptype: SAMPLE_PARTNER.type, where: b.where };
}

// The date/time field starts at "now" (set in the browser, not when the page is built).
const stampTime = (st: State): State => (st.f.when ? st : { ...st, f: { ...st.f, when: nowLocal() } });

export function InspectionForm() {
  const { state: S, setState, savedMsg, loaded, clear } = useDraft<State>("tmc-inspection-draft", blank, stampTime);
  const { toast, node: toastNode } = useToast();
  const [modal, setModal] = useState<null | "new" | "missing" | "summary" | "done">(null);
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<Record<string, { time: string }>>({});
  const carRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);

  const set = useCallback((patch: Partial<State>) => setState((p) => ({ ...p, ...patch })), [setState]);
  const setF = (k: keyof Fields) => (v: string) => setState((p) => ({ ...p, f: { ...p.f, [k]: v } }));

  const pick = useCallback(
    (b: Booking) => {
      setState(withBooking(b));
      toast("Booking details filled in");
    },
    [setState, toast],
  );

  // Opened from a job's "Start vehicle inspection" button: /inspection?job=TMC-10482
  useEffect(() => {
    if (!loaded) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only record list
      setRecords(JSON.parse(localStorage.getItem(INSPECTION_RECORDS_KEY) || "{}") || {});
    } catch {
      /* none */
    }
    const job = new URLSearchParams(window.location.search).get("job");
    const b = job && SAMPLE_BOOKINGS.find((x) => x.job === job);
    if (b && S.booking?.job !== b.job) pick(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const locked = (k: keyof Fields) => {
    if (!S.booking || S.unlocked) return false;
    const src = FROM_BOOKING.find(([key]) => key === k);
    return !!src && !!src[1](S.booking);
  };
  const lockSeg = !!S.booking && !S.unlocked;

  const req = useMemo(
    () => [
      S.f.job, S.f.partner, S.f.tech, S.f.vrm, S.f.mileage, S.fuelPct != null,
      S.dmg.length || S.nodamage,
      QUICK_CHECKS.every((_, i) => S.checks[i]),
      S.photos.length >= 4, S.sig.tech, S.sig.cust || S.absent, S.agree,
    ].map(Boolean),
    [S],
  );
  const pct = Math.round((req.filter(Boolean).length / req.length) * 100);
  const missing = REQUIRED.filter((_, i) => !req[i]);

  const summary = () => {
    const L = ["THE MOTORING CENTRAL – PRE-WORK VEHICLE INSPECTION"];
    L.push(`Job: ${S.f.job || "-"}   Date: ${fmtWhen(S.f.when)}`);
    L.push(`Partner: ${S.f.partner || "-"} (${S.ptype || "-"})   Technician: ${S.f.tech || "-"}   Location: ${S.where || "-"}`);
    L.push(`Vehicle: ${(S.f.vrm || "-").toUpperCase()}  ${S.f.make || ""} ${S.f.colour ? "(" + S.f.colour + ")" : ""} ${S.f.year || ""} ${S.f.fuelT || ""} ${S.f.gear || ""}   Mileage: ${S.f.mileage || "-"}   Fuel: ${fuelLabel(S.fuelPct) || "-"}`);
    L.push(`Customer: ${S.f.cname || "-"} ${S.f.cphone || ""}`);
    if (S.booking) L.push(`Service booked: ${S.booking.service}   Address: ${S.booking.address || "-"}`);
    L.push("", "EXISTING DAMAGE:");
    if (S.dmg.length) S.dmg.forEach((d, i) => L.push(`${i + 1}. ${d.where} – ${d.type}${d.size ? " – " + d.size : ""}${d.note ? " – " + d.note : ""}`));
    else L.push(S.nodamage ? "No visible damage found." : "None recorded.");
    L.push("", "QUICK CHECKS:");
    QUICK_CHECKS.forEach(([n], i) => L.push(`${n}: ${S.checks[i] || "-"}`));
    if (S.f.notes) L.push("", "NOTES: " + S.f.notes);
    L.push("", `Photos: ${S.photos.length}   Technician signed: ${S.sig.tech ? "Yes" : "No"}   Customer signed: ${S.sig.cust ? "Yes" : S.absent ? "Customer not present" : "No"}`);
    return L.join("\n");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary());
      toast("Summary copied");
    } catch {
      setModal("summary");
    }
  };

  const makePdf = async () => {
    if (busy) return;
    setBusy(true);
    toast("Building PDF…");
    try {
      const p = await startPdf("Pre-work Vehicle Inspection", "Record of vehicle condition before work started");
      const { doc, M } = p;
      p.heading("Job details");
      p.pairs([
        ["Job number", S.f.job], ["Date & time", fmtWhen(S.f.when)], ["Partner", S.f.partner], ["Partner type", S.ptype],
        ["Technician", S.f.tech], ["Location", S.where], ["Service booked", S.booking?.service], ["Address", S.booking?.address],
      ]);
      p.heading("Customer & vehicle");
      p.pairs([
        ["Registration", (S.f.vrm || "").toUpperCase()], ["Mileage", S.f.mileage], ["Make & model", S.f.make], ["Colour", S.f.colour],
        ["Year", S.f.year], ["Fuel type", S.f.fuelT], ["Gearbox", S.f.gear], ["Customer", S.f.cname], ["Phone", S.f.cphone],
        ["Fuel / charge", fuelLabel(S.fuelPct)],
      ]);
      p.heading("Existing damage", 60);
      await damageSection(p, carRef.current, S.dmg, S.nodamage ? "No visible damage found on the bodywork." : "No damage recorded.");
      p.heading("Quick checks");
      doc.setFontSize(9);
      QUICK_CHECKS.forEach(([n], i) => {
        p.need(6);
        const col = i % 2,
          x = M + col * 91;
        if (col === 0 && i > 0) p.y += 5.6;
        const v = S.checks[i] || "-";
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUT);
        doc.text(n, x, p.y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...(BAD_ANSWERS.has(v) ? hex("#E5484D") : NAVY));
        doc.text(v, x + 56, p.y);
      });
      p.y += 9;
      p.para("Notes", S.f.notes);
      p.heading("Signatures", 40);
      signatureSection(
        p,
        [["Technician", S.sig.tech, S.f.tech], ["Customer", S.sig.cust, S.f.cname]],
        S.absent ? "Customer not present – photo record taken" : null,
        (S.agree ? "Both parties agreed this is a true record of the vehicle condition before work started. " : "") + INSPECTION_LEGAL,
      );
      await photoPages(p, S.photos);
      const fname = `Inspection_${(S.f.vrm || "vehicle").replace(/\s+/g, "").toUpperCase()}_${(S.f.when || "").slice(0, 10)}.pdf`;
      finishPdf(p, `The Motoring Central Ltd · Inspection ${S.f.job || ""} · ${(S.f.vrm || "").toUpperCase()}`, fname);
      if (S.f.job) {
        const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        saveRecord(INSPECTION_RECORDS_KEY, S.f.job, { time, dmg: S.dmg.length, vrm: S.f.vrm || "" });
        setRecords((r) => ({ ...r, [S.f.job!]: { time } }));
      }
      setModal("done");
    } catch (e) {
      console.error(e);
      toast("Could not build the PDF – use Copy text instead");
    } finally {
      setBusy(false);
    }
  };

  const list = SAMPLE_BOOKINGS.filter((b) => (b.job + " " + b.vrm + " " + b.cname).toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <div className={s.root}>
      <Banner
        first="Pre-work"
        second="Vehicle Inspection"
        intro="Record existing damage before you start work. Takes about 3 minutes."
        demo="Preview: showing sample bookings until partner logins and bookings are built."
        pct={pct}
      />
      <div className={s.main}>
        {!S.manual && (
          <Card n="✓" title="Booking">
            {S.booking ? (
              <>
                <div className={s.selected}>
                  <span className={s.plate}>{S.booking.vrm || "No reg"}</span>
                  <div className={s.meta}>
                    <b>
                      {S.booking.job} · {S.booking.service}
                    </b>
                    {S.booking.cname} · {S.booking.time}
                    {S.booking.address ? " · " + S.booking.address : ""}
                  </div>
                </div>
                <div className={s.lockrow}>
                  <span>🔒 Details below filled from the booking</span>
                  <span>
                    <button
                      type="button"
                      className={s.linkbtn}
                      onClick={() => {
                        set({ unlocked: !S.unlocked });
                        if (!S.unlocked) toast("You can now correct the details");
                      }}
                    >
                      {S.unlocked ? "Lock details" : "Correct details"}
                    </button>{" "}
                    ·{" "}
                    <button type="button" className={s.linkbtn} onClick={() => set({ booking: null, unlocked: false })}>
                      Change booking
                    </button>
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className={s.hint}>Choose the booking you&rsquo;re at. Job, partner, customer and vehicle details fill in for you.</p>
                <input
                  className={s.input}
                  style={{ marginBottom: 10 }}
                  placeholder="Search job number, registration or name"
                  aria-label="Search bookings"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className={s.pickList}>
                  {list.map((b) => (
                    <button type="button" key={b.job} className={s.pickItem} onClick={() => pick(b)}>
                      <span className={s.plate}>{b.vrm || "No reg"}</span>
                      <span className={s.meta}>
                        <b>{b.cname}</b>
                        {b.job} · {b.service}
                        <br />
                        {b.make}
                        {records[b.job] && (
                          <>
                            <br />
                            <strong style={{ color: "var(--tick)" }}>Inspected at {records[b.job].time}</strong>
                          </>
                        )}
                      </span>
                      <span className={s.time}>{b.time}</span>
                    </button>
                  ))}
                </div>
                <div className={s.lockrow}>
                  <span>Booking not listed?</span>
                  <button type="button" className={s.linkbtn} onClick={() => set({ manual: true })}>
                    Fill in by hand
                  </button>
                </div>
              </>
            )}
          </Card>
        )}

        <Card n="1" title="Job details">
          <div className={s.grid}>
            <Field id="job" label="Booking / job number" placeholder="e.g. TMC-10482" value={S.f.job} onChange={setF("job")} locked={locked("job")} />
            <Field id="when" label="Date & time of inspection" type="datetime-local" value={S.f.when} onChange={setF("when")} />
            <Field id="partner" label="Partner business name" value={S.f.partner} onChange={setF("partner")} locked={locked("partner")} />
            <Field id="tech" label="Technician name" value={S.f.tech} onChange={setF("tech")} locked={locked("tech")} />
          </div>
          <Seg label="Partner type" options={PARTNER_TYPES} value={S.ptype} onChange={(v) => set({ ptype: v })} locked={lockSeg && !!S.ptype} />
          <Seg label="Where is the vehicle?" options={VEHICLE_LOCATIONS} value={S.where} onChange={(v) => set({ where: v })} locked={lockSeg && !!S.where} />
        </Card>

        <Card n="2" title="Customer & vehicle">
          <div className={s.grid}>
            <Field id="vrm" label="Registration" vrm placeholder="AB12 CDE" value={S.f.vrm} onChange={setF("vrm")} locked={locked("vrm")} />
            <Field
              id="mileage"
              label="Mileage"
              type="number"
              inputMode="numeric"
              placeholder={S.booking?.mileage ? `Booked as ${S.booking.mileage} – read the dashboard` : "Read from the dashboard"}
              value={S.f.mileage}
              onChange={setF("mileage")}
            />
            <Field id="make" label="Make & model" placeholder="e.g. Ford Focus" value={S.f.make} onChange={setF("make")} locked={locked("make")} />
            <Field id="colour" label="Colour" value={S.f.colour} onChange={setF("colour")} locked={locked("colour")} />
            <Field id="year" label="Year" inputMode="numeric" value={S.f.year} onChange={setF("year")} locked={locked("year")} />
            <Field id="fuelT" label="Fuel type" placeholder="Petrol, diesel, hybrid, electric" value={S.f.fuelT} onChange={setF("fuelT")} locked={locked("fuelT")} />
            <Field id="gear" label="Gearbox" placeholder="Manual or automatic" value={S.f.gear} onChange={setF("gear")} locked={locked("gear")} />
            <Field id="cname" label="Customer name" value={S.f.cname} onChange={setF("cname")} locked={locked("cname")} />
            <Field id="cphone" label="Customer phone" type="tel" value={S.f.cphone} onChange={setF("cphone")} locked={locked("cphone")} />
          </div>
          <FuelSlider label="Fuel / charge level" value={S.fuelPct} onChange={(v) => set({ fuelPct: v })} />
        </Card>

        <Card n="3" title="Mark existing damage" hint="Tap the car where there is damage. A numbered pin is added, then choose the type below.">
          <DamageDiagram damage={S.dmg} svgRef={carRef} emptyText="No damage marked yet. Tap the car above to add a pin." onChange={(dmg) => set({ dmg, nodamage: dmg.length ? false : S.nodamage })} />
          <Check
            checked={S.nodamage}
            onChange={(v) => {
              if (v && S.dmg.length) return toast("You have damage marked – remove pins first");
              set({ nodamage: v });
            }}
          >
            No visible damage found on the bodywork.
          </Check>
        </Card>

        <Card n="4" title="Quick checks">
          {QUICK_CHECKS.map(([name, opts], i) => (
            <div className={s.row} key={name}>
              <span className={s.lbl}>{name}</span>
              <Seg
                label={undefined}
                options={opts}
                value={S.checks[i]}
                tone={(o) => (BAD_ANSWERS.has(o) ? s.bad : s.ok)}
                onChange={(v) => setState((p) => ({ ...p, checks: { ...p.checks, [i]: v } }))}
              />
            </div>
          ))}
        </Card>

        <Card n="5" title="Photos" hint="Take at least 4 photos: front, back and both sides, plus a close-up of each damage and the dashboard mileage.">
          <Photos photos={S.photos} onChange={(photos) => set({ photos })} toast={toast} />
        </Card>

        <Card n="6" title="Notes">
          <TextArea
            id="notes"
            value={S.f.notes}
            onChange={setF("notes")}
            placeholder="Anything else worth recording: modifications, aftermarket parts, smells, noises, items in the vehicle, customer comments…"
          />
        </Card>

        <Card n="7" title="Signatures">
          <SignaturePad label="Technician signature" value={S.sig.tech} onChange={(v) => setState((p) => ({ ...p, sig: { ...p.sig, tech: v } }))} />
          <div className={s.mt} />
          <SignaturePad label="Customer signature" value={S.sig.cust} onChange={(v) => setState((p) => ({ ...p, sig: { ...p.sig, cust: v } }))} />
          <Check checked={S.absent} onChange={(v) => set({ absent: v })}>
            Customer not present. Photos taken as a record instead of a signature.
          </Check>
          <Check checked={S.agree} onChange={(v) => set({ agree: v })}>
            The customer and technician agree this is a true record of the vehicle&rsquo;s condition before work started.
          </Check>
          <div className={s.legal}>{INSPECTION_LEGAL}</div>
        </Card>
      </div>

      <ActionBar
        pct={pct}
        savedMsg={savedMsg}
        onNew={() => setModal("new")}
        onCopy={copy}
        onFinish={() => (missing.length ? setModal("missing") : makePdf())}
      />
      {toastNode}

      {modal === "new" && (
        <Modal onClose={() => setModal(null)}>
          <h3>Start a new inspection?</h3>
          <p>This clears the current form on this device. Save the PDF first if you need it.</p>
          <div className={s.acts}>
            <button type="button" className={cx(s.btn, s.ghost)} onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={s.btn}
              onClick={() => {
                clear();
                setModal(null);
                window.scrollTo(0, 0);
                toast("New inspection started");
              }}
            >
              Clear form
            </button>
          </div>
        </Modal>
      )}
      {modal === "missing" && (
        <Modal onClose={() => setModal(null)}>
          <h3>Still missing</h3>
          <ul>
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <div className={s.acts}>
            <button type="button" className={cx(s.btn, s.ghost)} onClick={() => setModal(null)}>
              Go back
            </button>
            <button
              type="button"
              className={cx(s.btn, s.yellow)}
              onClick={() => {
                setModal(null);
                makePdf();
              }}
            >
              Save anyway
            </button>
          </div>
        </Modal>
      )}
      {modal === "summary" && (
        <Modal onClose={() => setModal(null)}>
          <h3>Inspection summary</h3>
          <p className={s.hint}>Select all and copy.</p>
          <textarea className={s.input} readOnly value={summary()} aria-label="Inspection summary" />
          <div className={s.acts} style={{ marginTop: 10 }}>
            <button type="button" className={s.btn} onClick={() => setModal(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
      {modal === "done" && (
        <Modal onClose={() => setModal(null)}>
          <h3>Inspection saved ✓</h3>
          <p>The PDF is saved and this job is marked as inspected. You can start the work now.</p>
          <div className={s.acts}>
            <button
              type="button"
              className={cx(s.btn, s.yellow)}
              onClick={() => {
                clear();
                setModal(null);
                window.scrollTo(0, 0);
              }}
            >
              Back to my jobs
            </button>
            <button type="button" className={cx(s.btn, s.ghost)} onClick={() => setModal(null)}>
              Stay here
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
