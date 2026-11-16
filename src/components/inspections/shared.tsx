"use client";

// Parts shared by the vehicle inspection and the pre-delivery inspection (PDI) forms.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import "./forms.css";

// Class names for forms.css: s.card gives "tmcf-card", s.btn gives "tmcf-btn", and so on.
const s: Record<string, string> = new Proxy({}, { get: (_, k) => "tmcf-" + String(k) });

/* ---------------- types ---------------- */

export const DAMAGE_COLOURS = {
  Scratch: "#E5484D",
  Dent: "#F59E0B",
  Chip: "#8B5CF6",
  Crack: "#0EA5E9",
  Scuff: "#64748B",
  Rust: "#A16207",
  Missing: "#111827",
} as const;
export type DamageType = keyof typeof DAMAGE_COLOURS;
export const DAMAGE_TYPES = Object.keys(DAMAGE_COLOURS) as DamageType[];
export const DAMAGE_SIZES = ["Small (under 2cm)", "Medium (2–10cm)", "Large (over 10cm)"];

export type Damage = { x: number; y: number; where: string; type: DamageType; size: string; note: string };
export type Photo = { src: string; t: string };
export type Signatures = { tech?: string; cust?: string };

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------------- draft saved on this device ---------------- */

/** Keeps the form state in this browser so a half-done form survives a refresh or a lost signal. */
export function useDraft<T>(key: string, blank: () => T, fresh: (s: T) => T = (s) => s) {
  const [state, setState] = useState<T>(blank);
  const [loaded, setLoaded] = useState(false);
  const [savedMsg, setSavedMsg] = useState("Draft saved on this device");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the browser-only draft after the first render
      setState(fresh(raw ? { ...blank(), ...JSON.parse(raw) } : blank()));
    } catch {
      setState(fresh(blank()));
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
        setSavedMsg("Draft saved on this device");
      } catch {
        try {
          localStorage.setItem(key, JSON.stringify({ ...state, photos: [] }));
          setSavedMsg("Draft saved (photos not kept)");
        } catch {
          setSavedMsg("Draft not saved");
        }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [key, state, loaded]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setState(fresh(blank()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { state, setState, loaded, savedMsg, clear };
}

export function nowLocal() {
  const n = new Date();
  n.setMinutes(n.getMinutes() - n.getTimezoneOffset());
  return n.toISOString().slice(0, 16);
}

export function fmtWhen(v?: string) {
  return v ? new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "";
}

/* ---------------- toast & modal ---------------- */

export function useToast() {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2600);
  }, []);
  const node = (
    <div className={cx(s.toast, show && s.show)} role="status" aria-live="polite">
      {msg}
    </div>
  );
  return { toast, node };
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className={s.modal} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modalBox} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

/* ---------------- layout pieces ---------------- */

export function Banner({
  first,
  second,
  intro,
  demo,
  pct,
}: {
  first: string;
  second: string;
  intro: string;
  demo: string;
  pct: number;
}) {
  return (
    <div className={s.banner}>
      <div className={s.title}>
        <h1>
          {first} <span>{second}</span>
        </h1>
        <p>{intro}</p>
        <span className={s.demoNote}>{demo}</span>
      </div>
      <div className={s.bar}>
        <i style={{ width: pct + "%" }} />
      </div>
    </div>
  );
}

export function Card({ n, title, hint, children }: { n: string; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.card}>
      <h2>
        <span className={s.n}>{n}</span>
        {title}
      </h2>
      {hint && <p className={s.hint}>{hint}</p>}
      {children}
    </section>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  locked?: boolean;
  type?: "text" | "tel" | "number" | "datetime-local" | "date";
  inputMode?: "numeric" | "decimal" | "email" | "text";
  placeholder?: string;
  vrm?: boolean;
  maxLength?: number;
  caps?: boolean;
};

export function Field({ id, label, value, onChange, locked, type = "text", inputMode, placeholder, vrm, maxLength, caps }: FieldProps) {
  return (
    <div>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={cx(s.input, vrm && s.vrm, locked && s.locked)}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value ?? ""}
        readOnly={locked}
        maxLength={maxLength}
        autoCapitalize={caps || vrm ? "characters" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function TextArea({ id, label, value, onChange, placeholder }: { id: string; label?: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <>
      {label && (
        <label className={s.label} htmlFor={id}>
          {label}
        </label>
      )}
      <textarea id={id} className={s.input} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={label ? undefined : "Notes"} />
    </>
  );
}

/** A row of pill buttons. Tap the chosen one again to clear it. */
export function Seg({
  label,
  options,
  value,
  onChange,
  locked,
  tone,
  small,
}: {
  label?: string;
  options: string[];
  value?: string | null;
  onChange: (v: string | null) => void;
  locked?: boolean;
  tone?: (o: string) => string | undefined;
  small?: boolean;
}) {
  const seg = (
    <div className={cx(s.seg, locked && s.locked, small && s.small)} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={o}
          aria-pressed={value === o}
          className={cx(value === o && s.on, tone && tone(o))}
          onClick={() => !locked && onChange(value === o ? null : o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
  if (!label) return seg;
  return (
    <div className={s.mt}>
      <span className={s.label}>{label}</span>
      {seg}
    </div>
  );
}

export function Check({ checked, onChange, children }: { checked?: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className={s.check}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} /> <span>{children}</span>
    </label>
  );
}

/* ---------------- fuel / charge slider ---------------- */

const EIGHTHS = ["Empty", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞", "Full"];
export function fuelLabel(p: number | null | undefined) {
  if (p == null) return "";
  if (p <= 2) return "Empty (0%)";
  if (p >= 98) return "Full (100%)";
  const e = Math.round(p / 12.5);
  return (Math.abs(p - e * 12.5) < 2.6 ? "" : "About ") + EIGHTHS[e] + " (" + p + "%)";
}

export function FuelSlider({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div className={s.mt}>
      <span className={s.label}>{label}</span>
      <div className={s.gauge}>
        <div className={s.fill} style={{ width: (value ?? 0) + "%" }} />
        <div className={s.ticks}>
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className={s.fuelrow} aria-hidden="true">
        <span>E</span>
        <span>¼</span>
        <span>½</span>
        <span>¾</span>
        <span>F</span>
      </div>
      <input
        type="range"
        className={s.range}
        min={0}
        max={100}
        step={5}
        value={value ?? 50}
        aria-label={label}
        onChange={(e) => onChange(+e.target.value)}
      />
      <div className={s.fuelval}>
        <b>{value == null ? "Slide to set level" : fuelLabel(value)}</b>
        <button className={s.linkbtn} type="button" onClick={() => onChange(null)}>
          Clear
        </button>
      </div>
    </div>
  );
}

/* ---------------- car damage diagram ---------------- */

function zone(x: number, y: number) {
  const side = x < 86 ? "N/S " : x > 214 ? "O/S " : "";
  if (y < 52) return side + "Front bumper";
  if ((x < 76 || x > 224) && ((y > 90 && y < 156) || (y > 388 && y < 454))) return side + (y < 300 ? "front" : "rear") + " wheel";
  if ((x < 64 || x > 236) && y > 165 && y < 200) return side + "mirror";
  if (y < 162) return side ? side + "front wing" : "Bonnet";
  if (y < 210) return side ? side + "front wing / A-pillar" : "Windscreen";
  if (y < 358) return side ? side + (y < 284 ? "front door" : "rear door") : "Roof";
  if (y < 400) return side ? side + "rear quarter" : "Rear screen";
  if (y < 486) return side ? side + "rear quarter" : "Boot / tailgate";
  return side + "Rear bumper";
}
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const T = { fontFamily: "Inter,Arial,sans-serif", fontWeight: 700, fill: "#5A6B82" } as const;

/** The car outline drawing with numbered pins. Also used to draw the PDF image. */
export function CarSvg({ damage, svgRef, onTap }: { damage: Damage[]; svgRef?: React.Ref<SVGSVGElement>; onTap?: (e: React.MouseEvent<SVGSVGElement>) => void }) {
  return (
    <svg ref={svgRef} className={s.car} viewBox="0 0 300 540" xmlns="http://www.w3.org/2000/svg" onClick={onTap} role="img" aria-label="Car outline seen from above. Tap to mark damage.">
      <rect width="300" height="540" fill="#fff" />
      <text x="150" y="16" textAnchor="middle" fontSize="12" {...T}>FRONT</text>
      <text x="150" y="532" textAnchor="middle" fontSize="12" {...T}>REAR</text>
      <text x="16" y="270" textAnchor="middle" fontSize="11" {...T} transform="rotate(-90 16 270)">PASSENGER SIDE (N/S)</text>
      <text x="284" y="270" textAnchor="middle" fontSize="11" {...T} transform="rotate(90 284 270)">DRIVER SIDE (O/S)</text>
      <g fill="#0B1C35">
        <rect x="52" y="92" width="22" height="62" rx="7" />
        <rect x="226" y="92" width="22" height="62" rx="7" />
        <rect x="52" y="390" width="22" height="62" rx="7" />
        <rect x="226" y="390" width="22" height="62" rx="7" />
      </g>
      <path d="M95 28 Q150 18 205 28 Q232 34 236 70 L238 470 Q236 505 205 512 Q150 520 95 512 Q64 505 62 470 L64 70 Q68 34 95 28 Z" fill="#EAF6FD" stroke="#0B1C35" strokeWidth="3" />
      <path d="M64 178 L42 172 L42 190 L64 192 Z M236 178 L258 172 L258 190 L236 192 Z" fill="#EAF6FD" stroke="#0B1C35" strokeWidth="2.5" />
      <path d="M80 50 Q150 38 220 50" fill="none" stroke="#0B1C35" strokeWidth="2" opacity=".5" />
      <path d="M80 492 Q150 504 220 492" fill="none" stroke="#0B1C35" strokeWidth="2" opacity=".5" />
      <path d="M82 60 Q150 50 218 60 L214 160 Q150 152 86 160 Z" fill="none" stroke="#0B1C35" strokeWidth="2" />
      <path d="M86 168 Q150 158 214 168 L206 208 Q150 200 94 208 Z" fill="#BFE6FA" stroke="#0B1C35" strokeWidth="2" />
      <rect x="96" y="214" width="108" height="140" rx="10" fill="none" stroke="#0B1C35" strokeWidth="2" />
      <path d="M94 360 Q150 368 206 360 L212 396 Q150 404 88 396 Z" fill="#BFE6FA" stroke="#0B1C35" strokeWidth="2" />
      <path d="M86 404 Q150 412 214 404 L218 480 Q150 490 82 480 Z" fill="none" stroke="#0B1C35" strokeWidth="2" />
      <g stroke="#0B1C35" strokeWidth="2">
        <line x1="64" y1="196" x2="86" y2="196" />
        <line x1="236" y1="196" x2="214" y2="196" />
        <line x1="64" y1="284" x2="94" y2="284" />
        <line x1="236" y1="284" x2="206" y2="284" />
        <line x1="64" y1="372" x2="90" y2="372" />
        <line x1="236" y1="372" x2="210" y2="372" />
      </g>
      <g fill="#FFD43B" stroke="#0B1C35" strokeWidth="1.5">
        <path d="M74 40 L100 34 L98 46 L72 52 Z" />
        <path d="M226 40 L200 34 L202 46 L228 52 Z" />
      </g>
      <g fill="#E5484D" stroke="#0B1C35" strokeWidth="1.5">
        <path d="M72 488 L98 494 L98 504 L76 500 Z" />
        <path d="M228 488 L202 494 L202 504 L224 500 Z" />
      </g>
      {damage.map((d, i) => (
        <g key={i}>
          <circle cx={d.x} cy={d.y} r="11" fill={DAMAGE_COLOURS[d.type]} stroke="#fff" strokeWidth="2.5" />
          <text x={d.x} y={d.y + 4.5} textAnchor="middle" fontFamily="Inter,Arial,sans-serif" fontSize="12" fontWeight="700" fill="#fff">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function DamageDiagram({
  damage,
  onChange,
  svgRef,
  emptyText,
}: {
  damage: Damage[];
  onChange: (d: Damage[]) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  emptyText: string;
}) {
  const listEnd = useRef<HTMLDivElement>(null);
  const tap = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    if (p.x < 30 || p.x > 270 || p.y < 20 || p.y > 520) return;
    onChange([...damage, { x: Math.round(p.x), y: Math.round(p.y), where: cap(zone(p.x, p.y)), type: "Scratch", size: "", note: "" }]);
    setTimeout(() => listEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };
  const edit = (i: number, patch: Partial<Damage>) => onChange(damage.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <>
      <div className={s.diagram}>
        <CarSvg damage={damage} svgRef={svgRef} onTap={tap} />
        <div className={s.legend}>
          {DAMAGE_TYPES.map((t) => (
            <span key={t}>
              <i style={{ background: DAMAGE_COLOURS[t] }} />
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className={s.dmg}>
        {!damage.length && <div className={s.empty}>{emptyText}</div>}
        {damage.map((d, i) => (
          <div className={s.dmgItem} key={i}>
            <div className={s.dmgTop}>
              <span className={s.pin} style={{ background: DAMAGE_COLOURS[d.type] }}>
                {i + 1}
              </span>
              <input className={cx(s.input, s.where)} value={d.where} aria-label={`Where is mark ${i + 1}`} onChange={(e) => edit(i, { where: e.target.value })} />
              <button type="button" className={s.del} onClick={() => onChange(damage.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
            <div className={s.types}>
              {DAMAGE_TYPES.map((t) => (
                <button type="button" key={t} className={cx(d.type === t && s.on)} style={d.type === t ? { background: DAMAGE_COLOURS[t] } : undefined} onClick={() => edit(i, { type: t })}>
                  {t}
                </button>
              ))}
            </div>
            <div className={s.grid}>
              <select className={s.input} value={d.size} aria-label="Size" onChange={(e) => edit(i, { size: e.target.value })}>
                <option value="">Size…</option>
                {DAMAGE_SIZES.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
              <input className={s.input} placeholder="Note (optional)" value={d.note} aria-label="Note" onChange={(e) => edit(i, { note: e.target.value })} />
            </div>
          </div>
        ))}
        <div ref={listEnd} />
      </div>
    </>
  );
}

/* ---------------- photos ---------------- */

function shrink(file: File, max: number) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.78));
      };
      im.onerror = rej;
      im.src = r.result as string;
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function Photos({ photos, onChange, toast }: { photos: Photo[]; onChange: (p: Photo[]) => void; toast: (m: string) => void }) {
  const add = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    const added: Photo[] = [];
    for (const f of files) {
      try {
        added.push({ src: await shrink(f, 1200), t: new Date().toLocaleString("en-GB") });
      } catch {
        toast("Could not read one photo");
      }
    }
    onChange([...photos, ...added]);
  };
  return (
    <>
      <label className={s.upload}>
        📷 Take or add photos
        <input type="file" accept="image/*" capture="environment" multiple onChange={add} />
      </label>
      <div className={s.photos}>
        {photos.map((p, i) => (
          <figure key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element -- photos are local data URLs */}
            <img src={p.src} alt={`Photo ${i + 1}`} />
            <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(photos.filter((_, j) => j !== i))}>
              ×
            </button>
          </figure>
        ))}
      </div>
    </>
  );
}

/* ---------------- signature pad ---------------- */

export function SignaturePad({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const valueRef = useRef(value);

  const redraw = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    c.width = r.width * d;
    c.height = r.height * d;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0B1C35";
    const old = valueRef.current;
    if (old) {
      const im = new Image();
      im.onload = () => ctx.drawImage(im, 0, 0, r.width, r.height);
      im.src = old;
    }
  }, []);

  useEffect(() => {
    redraw();
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, [redraw]);

  // Redraw when the value is replaced from outside (draft loaded, form cleared).
  const drawn = useRef<string | undefined>(undefined);
  useEffect(() => {
    valueRef.current = value;
    if (value !== drawn.current) {
      drawn.current = value;
      redraw();
    }
  }, [value, redraw]);

  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <>
      <span className={s.label}>{label}</span>
      <div className={s.sig}>
        <canvas
          ref={ref}
          aria-label={label + " box. Sign with your finger or mouse."}
          onPointerDown={(e) => {
            drawing.current = true;
            last.current = pos(e);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const p = pos(e);
            const ctx = ref.current!.getContext("2d")!;
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
          }}
          onPointerUp={() => {
            if (!drawing.current) return;
            drawing.current = false;
            const url = ref.current!.toDataURL("image/png");
            drawn.current = url;
            onChange(url);
          }}
          onPointerCancel={() => (drawing.current = false)}
        />
        <div className={s.base} />
        <button
          type="button"
          className={s.clr}
          onClick={() => {
            const c = ref.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            drawn.current = undefined;
            onChange(undefined);
          }}
        >
          Clear
        </button>
      </div>
    </>
  );
}

/* ---------------- bottom action bar ---------------- */

export function ActionBar({ pct, savedMsg, onNew, onCopy, onFinish }: { pct: number; savedMsg: string; onNew: () => void; onCopy: () => void; onFinish: () => void }) {
  return (
    <div className={s.actions}>
      <div className={s.progress}>
        <span>{pct}% complete</span>
        <span>{savedMsg}</span>
      </div>
      <div className={s.in}>
        <button type="button" className={cx(s.btn, s.ghost)} onClick={onNew}>
          New
        </button>
        <button type="button" className={cx(s.btn, s.ghost)} onClick={onCopy}>
          Copy text
        </button>
        <button type="button" className={cx(s.btn, s.yellow)} onClick={onFinish}>
          Finish &amp; save PDF
        </button>
      </div>
    </div>
  );
}

export { s as styles };
