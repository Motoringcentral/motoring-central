"use client";

// Pre-delivery inspection (PDI) for car and van dealers (update TMC-UPD-20261115-A).
// The dealer picks the vehicle from their stock; advert details fill in and lock.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionBar, Banner, Card, Check, DamageDiagram, Field, FuelSlider, Modal, Photos, Seg, SignaturePad, TextArea,
  cx, fmtWhen, fuelLabel, nowLocal, styles as s, useDraft, useToast, type Damage, type Photo, type Signatures,
} from "./shared";
import { AMB, damageSection, finishPdf, GRN, MUT, NAVY, photoPages, RED, SKY, signatureSection, startPdf } from "./pdf";
import {
  HANDOVER_METHODS, KEYS, PAYMENTS, PDI_LEGAL, PDI_OPTIONS, PDI_RECORDS_KEY, PDI_SECTIONS, SAMPLE_DEALER, SAMPLE_STOCK,
  TYRES, WARRANTIES, saveRecord, type StockVehicle,
} from "@/lib/inspections";

type Fields = Partial<Record<
  | "dealer" | "staff" | "stockno" | "when" | "price" | "sold" | "bname" | "bphone" | "bemail" | "baddr"
  | "vrm" | "vin" | "make" | "variant" | "year" | "colour" | "fuelT" | "gear" | "mileage" | "mot" | "svc" | "work" | "advice",
  string
>>;
type State = {
  f: Fields;
  fuelPct: number | null;
  seg: Partial<Record<"method" | "warranty" | "pay" | "keys", string | null>>;
  checks: Record<string, string | null>;
  tyres: Record<string, { mm?: string; psi?: string }>;
  dmg: Damage[];
  nodamage: boolean;
  photos: Photo[];
  sig: Signatures;
  absent: boolean;
  agree: boolean;
  veh: StockVehicle | null;
  unlocked: boolean;
  manual: boolean;
};

const blank = (): State => ({
  f: { dealer: SAMPLE_DEALER.name },
  fuelPct: null,
  seg: {},
  checks: {},
  tyres: {},
  dmg: [],
  nodamage: false,
  photos: [],
  sig: {},
  absent: false,
  agree: false,
  veh: null,
  unlocked: false,
  manual: false,
});

const FROM_STOCK: [keyof Fields, (v: StockVehicle) => string | number | undefined][] = [
  ["dealer", () => SAMPLE_DEALER.name],
  ["stockno", (v) => v.stockno],
  ["price", (v) => v.soldPrice ?? v.price],
  ["sold", (v) => v.soldDate],
  ["vrm", (v) => v.reg],
  ["make", (v) => [v.make, v.model].filter(Boolean).join(" ")],
  ["variant", (v) => v.variant],
  ["year", (v) => v.year],
  ["colour", (v) => v.col],
  ["fuelT", (v) => v.fuel],
  ["gear", (v) => v.gear],
];

const REQUIRED = [
  "Dealer", "Prepared by", "Buyer name", "Registration", "VIN", "Mileage at handover", "Handover method", "Keys handed over",
  "Fuel level", "Every checklist item", "Tyre tread for all 4 tyres", 'Bodywork marked (or "no damage" ticked)',
  "At least 4 photos", "Dealer signature", 'Buyer signature (or "not present")', "Buyer acceptance box",
];

const money = (n?: number | string) => (n ? "£" + Number(n).toLocaleString("en-GB") : "");
const optTone = (o: string) => (o === "Advise" ? s.adv : o === "Fixed" ? s.fix : o === "OK" ? s.ok : s.na);

function withVehicle(v: StockVehicle): State {
  const st = blank();
  for (const [k, get] of FROM_STOCK) {
    const x = get(v);
    if (x != null && x !== "") st.f[k] = String(x);
  }
  return { ...stampTime(st), veh: v };
}

// The date/time field starts at "now" (set in the browser, not when the page is built).
const stampTime = (st: State): State => (st.f.when ? st : { ...st, f: { ...st.f, when: nowLocal() } });

export function PdiForm() {
  const { state: S, setState, savedMsg, loaded, clear } = useDraft<State>("tmc-pdi-draft", blank, stampTime);
  const { toast, node: toastNode } = useToast();
  const [modal, setModal] = useState<null | "new" | "missing" | "summary" | "done">(null);
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<Record<string, { date: string }>>({});
  const [vanByHand, setVanByHand] = useState(false);
  const carRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);

  const set = useCallback((patch: Partial<State>) => setState((p) => ({ ...p, ...patch })), [setState]);
  const setF = (k: keyof Fields) => (v: string) => setState((p) => ({ ...p, f: { ...p.f, [k]: v } }));
  const setSeg = (k: keyof State["seg"]) => (v: string | null) => setState((p) => ({ ...p, seg: { ...p.seg, [k]: v } }));

  const pick = useCallback(
    (v: StockVehicle) => {
      setState(withVehicle(v));
      toast("Vehicle details filled in");
    },
    [setState, toast],
  );

  // Opened from a stock item's "PDI" button: /pdi?vehicle=demo:3
  useEffect(() => {
    if (!loaded) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only record list
      setRecords(JSON.parse(localStorage.getItem(PDI_RECORDS_KEY) || "{}") || {});
    } catch {
      /* none */
    }
    const key = new URLSearchParams(window.location.search).get("vehicle");
    const v = key && SAMPLE_STOCK.find((x) => x.key === key);
    if (v && S.veh?.key !== v.key) pick(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const isVan = S.veh ? S.veh.kind === "Van" : vanByHand;
  const sections = useMemo(() => PDI_SECTIONS.filter((x) => !x.vanOnly || isVan), [isVan]);

  const locked = (k: keyof Fields) => {
    if (!S.veh || S.unlocked) return false;
    const src = FROM_STOCK.find(([key]) => key === k);
    const v = src && src[1](S.veh);
    return v != null && v !== "";
  };

  const allChecked = sections.every((x) => x.items.every((it) => S.checks[x.title + "|" + it]));
  const req = [
    S.f.dealer, S.f.staff, S.f.bname, S.f.vrm, S.f.vin, S.f.mileage, S.seg.method, S.seg.keys, S.fuelPct != null, allChecked,
    TYRES.slice(0, 4).every((t) => S.tyres[t]?.mm), S.dmg.length || S.nodamage, S.photos.length >= 4, S.sig.tech,
    S.sig.cust || S.absent, S.agree,
  ].map(Boolean);
  const pct = Math.round((req.filter(Boolean).length / req.length) * 100);
  const missing = REQUIRED.filter((_, i) => !req[i]);

  const allOk = () => {
    let n = 0;
    const checks = { ...S.checks };
    sections.forEach((x) =>
      x.items.forEach((it) => {
        const k = x.title + "|" + it;
        if (!checks[k]) {
          checks[k] = "OK";
          n++;
        }
      }),
    );
    set({ checks });
    toast(n ? n + " items marked OK – check any that are not" : "Everything is already answered");
  };

  const summary = () => {
    const L = ["THE MOTORING CENTRAL – PRE-DELIVERY INSPECTION"];
    L.push(`Dealer: ${S.f.dealer || "-"}   Prepared by: ${S.f.staff || "-"}   Stock no: ${S.f.stockno || "-"}`);
    L.push(`Handover: ${fmtWhen(S.f.when)}   Method: ${S.seg.method || "-"}   Warranty: ${S.seg.warranty || "-"}   Sale price: ${money(S.f.price) || "-"}`);
    L.push(`Buyer: ${S.f.bname || "-"} ${S.f.bphone || ""} ${S.f.bemail || ""} ${S.f.baddr || ""}   Payment: ${S.seg.pay || "-"}`);
    L.push(`Vehicle: ${(S.f.vrm || "-").toUpperCase()} ${S.f.make || ""} ${S.f.variant || ""} ${S.f.year || ""} ${S.f.colour || ""} ${S.f.fuelT || ""} ${S.f.gear || ""}`);
    L.push(`VIN: ${S.f.vin || "-"}   Mileage: ${S.f.mileage || "-"}   MOT expiry: ${S.f.mot || "-"}   Last service: ${S.f.svc || "-"}   Keys: ${S.seg.keys || "-"}   Fuel: ${fuelLabel(S.fuelPct) || "-"}`);
    sections.forEach((x) => {
      L.push("", x.title.toUpperCase() + ":");
      x.items.forEach((it) => L.push(`${it}: ${S.checks[x.title + "|" + it] || "-"}`));
    });
    L.push("", "TYRES: " + TYRES.map((t) => `${t} ${S.tyres[t]?.mm || "-"}mm ${S.tyres[t]?.psi || "-"}psi`).join("; "));
    L.push("", "BODYWORK:");
    if (S.dmg.length) S.dmg.forEach((d, i) => L.push(`${i + 1}. ${d.where} – ${d.type}${d.size ? " – " + d.size : ""}${d.note ? " – " + d.note : ""}`));
    else L.push(S.nodamage ? "No visible damage." : "None recorded.");
    if (S.f.work) L.push("", "WORK CARRIED OUT: " + S.f.work);
    if (S.f.advice) L.push("", "ADVISORIES: " + S.f.advice);
    L.push("", `Photos: ${S.photos.length}   Dealer signed: ${S.sig.tech ? "Yes" : "No"}   Buyer signed: ${S.sig.cust ? "Yes" : S.absent ? "Buyer not present" : "No"}`);
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
      const p = await startPdf("Pre-delivery Inspection", (S.f.dealer || "") + " · vehicle handover record");
      const { doc, M } = p;
      const d = (v?: string) => (v ? new Date(v).toLocaleDateString("en-GB") : "");
      p.heading("Sale & handover");
      p.pairs([
        ["Dealer", S.f.dealer], ["Prepared by", S.f.staff], ["Stock number", S.f.stockno], ["Handover", fmtWhen(S.f.when)],
        ["Sale price", money(S.f.price)], ["Date sold", d(S.f.sold)], ["Handover method", S.seg.method], ["Warranty", S.seg.warranty],
      ]);
      p.heading("Buyer");
      p.pairs([["Name", S.f.bname], ["Phone", S.f.bphone], ["Email", S.f.bemail], ["Payment", S.seg.pay], ["Address", S.f.baddr]]);
      p.heading("Vehicle");
      p.pairs([
        ["Registration", (S.f.vrm || "").toUpperCase()], ["VIN", (S.f.vin || "").toUpperCase()], ["Make & model", S.f.make],
        ["Engine / trim", S.f.variant], ["Year", S.f.year], ["Colour", S.f.colour], ["Fuel type", S.f.fuelT], ["Gearbox", S.f.gear],
        ["Mileage", S.f.mileage ? Number(S.f.mileage).toLocaleString("en-GB") : ""], ["MOT expiry", d(S.f.mot)],
        ["Last service", S.f.svc], ["Keys", S.seg.keys], ["Fuel / charge", fuelLabel(S.fuelPct)],
      ]);
      p.heading("Inspection checklist", 20);
      sections.forEach((x) => {
        p.need(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...NAVY);
        doc.text(x.title, M, p.y);
        p.y += 5;
        doc.setFontSize(8.5);
        x.items.forEach((it, i) => {
          const col = i % 2,
            xx = M + col * 91;
          if (col === 0) p.need(5);
          const v = S.checks[x.title + "|" + it] || "-";
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...MUT);
          doc.text((doc.splitTextToSize(it, 62) as string[])[0], xx, p.y);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...(v === "Advise" ? AMB : v === "Fixed" ? SKY : v === "OK" ? GRN : NAVY));
          doc.text(v, xx + 66, p.y);
          if (col === 1 || i === x.items.length - 1) p.y += 4.8;
        });
        p.y += 2.5;
      });
      p.heading("Tyres", 30);
      doc.setFontSize(9);
      TYRES.forEach((t, i) => {
        const v = S.tyres[t] || {},
          x = M + (i % 3) * 61;
        if (i % 3 === 0 && i > 0) p.y += 6;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUT);
        doc.text(t, x, p.y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...(v.mm && +v.mm < 1.6 ? RED : NAVY));
        doc.text(`${v.mm || "-"} mm · ${v.psi || "-"} psi`, x + 22, p.y);
      });
      p.y += 10;
      p.heading("Bodywork condition at handover", 60);
      await damageSection(p, carRef.current, S.dmg, S.nodamage ? "No visible damage on the bodywork." : "No marks recorded.");
      p.para("Work carried out before sale", S.f.work);
      p.para("Advisories given to the buyer", S.f.advice);
      p.heading("Handover & signatures", 40);
      signatureSection(
        p,
        [["Dealer", S.sig.tech, S.f.staff], ["Buyer", S.sig.cust, S.f.bname]],
        S.absent ? "Buyer not present – delivery photos taken" : null,
        (S.agree ? "The buyer has seen the vehicle, received the documents and keys listed, and accepts its condition as recorded. " : "") + PDI_LEGAL,
      );
      await photoPages(p, S.photos);
      const fname = `PDI_${(S.f.vrm || "vehicle").replace(/\s+/g, "").toUpperCase()}_${(S.f.when || "").slice(0, 10)}.pdf`;
      finishPdf(p, `The Motoring Central Ltd · PDI · ${S.f.dealer || ""} · ${(S.f.vrm || "").toUpperCase()}`, fname);
      const key = S.veh?.key || "reg:" + (S.f.vrm || "").toUpperCase().replace(/\s/g, "");
      const date = new Date().toLocaleDateString("en-GB");
      saveRecord(PDI_RECORDS_KEY, key, { date, buyer: S.f.bname || "" });
      setRecords((r) => ({ ...r, [key]: { date } }));
      setModal("done");
    } catch (e) {
      console.error(e);
      toast("Could not build the PDF – use Copy text instead");
    } finally {
      setBusy(false);
    }
  };

  const list = SAMPLE_STOCK.filter((v) => (v.reg + " " + v.make + " " + v.model).toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <div className={s.root}>
      <Banner
        first="Pre-delivery"
        second="Inspection"
        intro="Complete before the vehicle is handed over or delivered to the buyer."
        demo="Preview: showing sample stock until dealer logins and adverts are built."
        pct={pct}
      />
      <div className={s.main}>
        {!S.manual && (
          <Card n="✓" title="Vehicle">
            {S.veh ? (
              <>
                <div className={s.selected}>
                  <span className={s.plate}>{S.veh.reg || "No reg"}</span>
                  <div className={s.meta}>
                    <b>{[S.veh.year, S.veh.make, S.veh.model].filter(Boolean).join(" ")}</b>
                    {S.veh.variant}
                    {S.veh.price ? " · " + money(S.veh.price) : ""}
                    {S.veh.stockno ? " · " + S.veh.stockno : ""}
                  </div>
                </div>
                <div className={s.lockrow}>
                  <span>🔒 Vehicle details filled from your advert</span>
                  <span>
                    <button type="button" className={s.linkbtn} onClick={() => set({ unlocked: !S.unlocked })}>
                      {S.unlocked ? "Lock details" : "Correct details"}
                    </button>{" "}
                    ·{" "}
                    <button type="button" className={s.linkbtn} onClick={() => set({ veh: null, unlocked: false })}>
                      Change vehicle
                    </button>
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className={s.hint}>Choose the vehicle you are handing over. Its details fill in for you.</p>
                <input
                  className={s.input}
                  style={{ marginBottom: 10 }}
                  placeholder="Search registration, make or model"
                  aria-label="Search stock"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className={s.pickList}>
                  {list.map((v) => (
                    <button type="button" key={v.key} className={s.pickItem} onClick={() => pick(v)}>
                      <span className={s.plate}>{v.reg || "No reg"}</span>
                      <span className={s.meta}>
                        <b>{[v.year, v.make, v.model].filter(Boolean).join(" ")}</b>
                        {v.variant}
                        {v.kind === "Van" ? " · Van" : ""}
                        {records[v.key] && (
                          <>
                            <br />
                            <strong style={{ color: "var(--tick)" }}>PDI ✓ {records[v.key].date}</strong>
                          </>
                        )}
                      </span>
                      <span className={s.time}>{money(v.price)}</span>
                    </button>
                  ))}
                </div>
                <div className={s.lockrow}>
                  <span>Vehicle not listed?</span>
                  <button type="button" className={s.linkbtn} onClick={() => set({ manual: true })}>
                    Fill in by hand
                  </button>
                </div>
              </>
            )}
          </Card>
        )}

        <Card n="1" title="Sale & handover">
          <div className={s.grid}>
            <Field id="dealer" label="Dealer" value={S.f.dealer} onChange={setF("dealer")} locked={locked("dealer")} />
            <Field id="staff" label="Prepared by" placeholder="Name of person doing the PDI" value={S.f.staff} onChange={setF("staff")} />
            <Field id="stockno" label="Stock number" value={S.f.stockno} onChange={setF("stockno")} locked={locked("stockno")} />
            <Field id="when" label="Date & time of handover" type="datetime-local" value={S.f.when} onChange={setF("when")} />
            <Field id="price" label="Sale price (£)" type="number" inputMode="decimal" value={S.f.price} onChange={setF("price")} locked={locked("price")} />
            <Field id="sold" label="Date sold" type="date" value={S.f.sold} onChange={setF("sold")} locked={locked("sold")} />
          </div>
          <Seg label="Handover method" options={HANDOVER_METHODS} value={S.seg.method} onChange={setSeg("method")} />
          <Seg label="Dealer warranty" options={WARRANTIES} value={S.seg.warranty} onChange={setSeg("warranty")} />
        </Card>

        <Card n="2" title="Buyer">
          <div className={s.grid}>
            <Field id="bname" label="Buyer name" value={S.f.bname} onChange={setF("bname")} />
            <Field id="bphone" label="Phone" type="tel" value={S.f.bphone} onChange={setF("bphone")} />
            <Field id="bemail" label="Email" inputMode="email" value={S.f.bemail} onChange={setF("bemail")} />
            <Field id="baddr" label="Address and postcode" value={S.f.baddr} onChange={setF("baddr")} />
          </div>
          <Seg label="Payment" options={PAYMENTS} value={S.seg.pay} onChange={setSeg("pay")} />
        </Card>

        <Card n="3" title="Vehicle details">
          <div className={s.grid}>
            <Field id="vrm" label="Registration" vrm placeholder="AB12 CDE" value={S.f.vrm} onChange={setF("vrm")} locked={locked("vrm")} />
            <Field id="vin" label="VIN / chassis number" placeholder="17 characters" caps maxLength={17} value={S.f.vin} onChange={setF("vin")} />
            <Field id="make" label="Make & model" value={S.f.make} onChange={setF("make")} locked={locked("make")} />
            <Field id="variant" label="Engine / trim" value={S.f.variant} onChange={setF("variant")} locked={locked("variant")} />
            <Field id="year" label="Year" inputMode="numeric" value={S.f.year} onChange={setF("year")} locked={locked("year")} />
            <Field id="colour" label="Colour" value={S.f.colour} onChange={setF("colour")} locked={locked("colour")} />
            <Field id="fuelT" label="Fuel type" value={S.f.fuelT} onChange={setF("fuelT")} locked={locked("fuelT")} />
            <Field id="gear" label="Gearbox" value={S.f.gear} onChange={setF("gear")} locked={locked("gear")} />
            <Field
              id="mileage"
              label="Mileage at handover"
              type="number"
              inputMode="numeric"
              placeholder={S.veh?.miles ? `Advertised at ${S.veh.miles.toLocaleString("en-GB")} – read the dashboard` : "Read from the dashboard"}
              value={S.f.mileage}
              onChange={setF("mileage")}
            />
            <Field id="mot" label="MOT expiry" type="date" value={S.f.mot} onChange={setF("mot")} />
            <Field id="svc" label="Last service (date or mileage)" value={S.f.svc} onChange={setF("svc")} />
          </div>
          {!S.veh && <Check checked={vanByHand} onChange={setVanByHand}>This is a van (adds the van checks)</Check>}
          <Seg label="Keys handed over" options={KEYS} value={S.seg.keys} onChange={setSeg("keys")} />
          <FuelSlider label="Fuel / charge level at handover" value={S.fuelPct} onChange={(v) => set({ fuelPct: v })} />
        </Card>

        <Card
          n="4"
          title="Inspection checklist"
          hint={
            <>
              Mark each item. <b>OK</b> = checked and fine · <b>Fixed</b> = put right before handover · <b>Advise</b> = buyer told ·{" "}
              <b>N/A</b> = not fitted.
            </>
          }
        >
          <button type="button" className={cx(s.btn, s.ghost, s.compact)} onClick={allOk}>
            Mark everything not yet answered as OK
          </button>
          {sections.map((x) => (
            <div className={s.csec} key={x.title}>
              <h3>{x.title}</h3>
              {x.items.map((it) => {
                const k = x.title + "|" + it;
                return (
                  <div className={s.row} key={k}>
                    <span className={s.lbl}>{it}</span>
                    <Seg small options={PDI_OPTIONS} value={S.checks[k]} tone={optTone} onChange={(v) => setState((p) => ({ ...p, checks: { ...p.checks, [k]: v } }))} />
                  </div>
                );
              })}
            </div>
          ))}
        </Card>

        <Card n="5" title="Tyre tread & pressures" hint="UK legal minimum is 1.6 mm. Most dealers supply at least 3 mm.">
          <div className={cx(s.trow, s.th)}>
            <span />
            <span>Tread (mm)</span>
            <span>Pressure (psi)</span>
          </div>
          {TYRES.map((t) => {
            const v = S.tyres[t] || {};
            const put = (k: "mm" | "psi", val: string) => setState((p) => ({ ...p, tyres: { ...p.tyres, [t]: { ...p.tyres[t], [k]: val } } }));
            return (
              <div className={s.trow} key={t}>
                <span className={s.lbl}>{t}</span>
                <input
                  className={cx(s.input, v.mm !== undefined && v.mm !== "" && +v.mm < 1.6 && s.low)}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="mm"
                  aria-label={`${t} tread in mm`}
                  value={v.mm ?? ""}
                  onChange={(e) => put("mm", e.target.value)}
                />
                <input className={s.input} type="number" inputMode="numeric" placeholder="psi" aria-label={`${t} pressure in psi`} value={v.psi ?? ""} onChange={(e) => put("psi", e.target.value)} />
              </div>
            );
          })}
        </Card>

        <Card n="6" title="Bodywork condition at handover" hint="Tap the car to mark any marks the buyer has seen and accepted. Then choose the type below.">
          <DamageDiagram damage={S.dmg} svgRef={carRef} emptyText="No marks recorded. Tap the car above to add one." onChange={(dmg) => set({ dmg, nodamage: dmg.length ? false : S.nodamage })} />
          <Check
            checked={S.nodamage}
            onChange={(v) => {
              if (v && S.dmg.length) return toast("Remove the damage pins first");
              set({ nodamage: v });
            }}
          >
            No visible damage on the bodywork.
          </Check>
        </Card>

        <Card n="7" title="Photos" hint="Take at least 4: front, back, both sides, plus the dashboard showing mileage and no warning lights.">
          <Photos photos={S.photos} onChange={(photos) => set({ photos })} toast={toast} />
        </Card>

        <Card n="8" title="Work done & advisories">
          <TextArea id="work" label="Work carried out before sale" value={S.f.work} onChange={setF("work")} placeholder="e.g. Oil and filter service, 2 new front tyres, MOT, wiper blades, full valet" />
          <div className={s.mt} />
          <TextArea id="advice" label="Advisories given to the buyer" value={S.f.advice} onChange={setF("advice")} placeholder="e.g. Rear brake pads around 4 mm – replace within 6 months" />
        </Card>

        <Card n="9" title="Handover & signatures">
          <SignaturePad label="Dealer signature" value={S.sig.tech} onChange={(v) => setState((p) => ({ ...p, sig: { ...p.sig, tech: v } }))} />
          <div className={s.mt} />
          <SignaturePad label="Buyer signature" value={S.sig.cust} onChange={(v) => setState((p) => ({ ...p, sig: { ...p.sig, cust: v } }))} />
          <Check checked={S.absent} onChange={(v) => set({ absent: v })}>
            Buyer not present (delivered). Photos taken at delivery instead of a signature.
          </Check>
          <Check checked={S.agree} onChange={(v) => set({ agree: v })}>
            The buyer has seen the vehicle, received the documents and keys listed, and accepts its condition as recorded.
          </Check>
          <div className={s.legal}>{PDI_LEGAL}</div>
        </Card>
      </div>

      <ActionBar pct={pct} savedMsg={savedMsg} onNew={() => setModal("new")} onCopy={copy} onFinish={() => (missing.length ? setModal("missing") : makePdf())} />
      {toastNode}

      {modal === "new" && (
        <Modal onClose={() => setModal(null)}>
          <h3>Start a new PDI?</h3>
          <p>This clears the form on this device. Save the PDF first if you need it.</p>
          <div className={s.acts}>
            <button type="button" className={cx(s.btn, s.ghost)} onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={s.btn}
              onClick={() => {
                clear();
                setVanByHand(false);
                setModal(null);
                window.scrollTo(0, 0);
                toast("New PDI started");
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
          <h3>PDI summary</h3>
          <textarea className={s.input} readOnly value={summary()} aria-label="PDI summary" />
          <div className={s.acts} style={{ marginTop: 10 }}>
            <button type="button" className={s.btn} onClick={() => setModal(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
      {modal === "done" && (
        <Modal onClose={() => setModal(null)}>
          <h3>PDI saved ✓</h3>
          <p>The PDF is saved and this vehicle is marked as PDI complete in your stock.</p>
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
              Back to my stock
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
