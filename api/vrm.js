/*
 * Live registration (VRM) look-up through Vehicle Data Global.
 *
 * The website calls  /api/vrm?reg=AB12CDE  and gets back the vehicle's details.
 * The API key never reaches the browser: it lives in Vercel as an environment variable.
 *
 * Vercel → project motoring-central-gum8 → Settings → Environment Variables:
 *   VDG_API_KEY   your Vehicle Data Global API key (required)
 *   VDG_PACKAGE   the data package name on your account (optional, default "VehicleData")
 *   VDG_BASE_URL  only if Vehicle Data Global gives you a different address (optional)
 *
 * Without VDG_API_KEY this answers 503 "not_configured" and the site carries on with its sample data.
 */

const DEFAULT_BASE = "https://uk1.ukvehicledata.co.uk/api/datapackage";
const REG_RE = /^[A-Z0-9]{2,8}$/;

/* best-effort limit per visitor, so nobody can run up the bill (each look-up costs money) */
const hits = new Map();
const LIMIT = 20; // look-ups
const WINDOW = 10 * 60 * 1000; // per 10 minutes
function limited(ip) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  h.push(now);
  hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.length > LIMIT;
}

function send(res, status, body, cache) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-VRM", "1");
  res.setHeader("Cache-Control", cache || "no-store");
  res.end(JSON.stringify(body));
}

/* only our own pages may use the look-up */
function sameSite(req) {
  const site = req.headers["sec-fetch-site"];
  if (site) return site === "same-origin";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const from = String(req.headers.origin || req.headers.referer || "");
  if (!from) return false;
  try {
    return new URL(from).host === host;
  } catch {
    return false;
  }
}

/* ---------- reading the Vehicle Data Global answer ---------- */

function get(obj, path) {
  return path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}
function first(obj, paths) {
  for (const p of paths) {
    const v = get(obj, p);
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}
/* finds the first key with one of these names anywhere in the answer (packages differ in layout) */
function find(obj, names, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 7) return undefined;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (names.includes(k.toLowerCase()) && v !== null && typeof v !== "object" && String(v).trim() !== "") return v;
  }
  for (const k of Object.keys(obj)) {
    const r = find(obj[k], names, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}
function pick(d, paths, names) {
  const v = first(d, paths);
  return v !== undefined ? v : find(d, names);
}

const KEEP_UPPER = new Set(["BMW", "MG", "VW", "DS", "GTI", "TDI", "TSI", "TFSI", "AMG", "SE", "GT", "ST", "RS", "HDI", "CDI", "DCI", "TDCI", "SRI", "LWB", "SWB", "MWB", "EV", "PHEV", "HEV", "XL", "LE", "SR", "GL", "GLS", "SLK", "CLA", "GLA", "GLC", "GLE", "TT", "UK", "4X4", "AWD", "4WD", "FWD", "RWD", "CVT", "DSG", "LX", "EX", "SX", "VVT", "VTEC", "CRDI", "D4D", "TCE", "BLUEHDI", "ECOBOOST"]);
const NICE = { KIA: "Kia", BLUEHDI: "BlueHDi", ECOBOOST: "EcoBoost", "MERCEDES-BENZ": "Mercedes-Benz" };
function clean(v) {
  return String(v == null ? "" : v).replace(/[<>&"'`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}
function title(v) {
  const s = clean(v);
  if (!s) return "";
  return s
    .split(" ")
    .map((w) => {
      const u = w.toUpperCase();
      if (NICE[u]) return NICE[u];
      if (KEEP_UPPER.has(u) || /\d/.test(w)) return u;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}
function isoDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
function fuel(v) {
  const s = String(v || "").toUpperCase();
  if (!s) return "";
  if (s.includes("ELECTRIC") && (s.includes("PETROL") || s.includes("DIESEL") || s.includes("HYBRID"))) return "Hybrid";
  if (s.includes("HYBRID")) return "Hybrid";
  if (s.includes("ELECTRIC")) return "Electric";
  if (s.includes("DIESEL") || s === "HEAVY OIL") return "Diesel";
  if (s.includes("PETROL")) return "Petrol";
  return title(s);
}
function gear(v) {
  const s = String(v || "").toUpperCase();
  if (!s) return "";
  if (s.includes("AUTO") || s.includes("CVT") || s.includes("DSG")) return "Automatic";
  if (s.includes("MANUAL")) return "Manual";
  return title(s);
}

function normalise(reg, d) {
  const make = pick(d, ["VehicleRegistration.Make", "ClassificationDetails.Dvla.Make", "SmmtDetails.Marque"], ["make", "marque"]);
  const range = first(d, ["SmmtDetails.Range", "ClassificationDetails.Smmt.Range", "ClassificationDetails.Smmt.Model"]);
  const dvlaModel = first(d, ["VehicleRegistration.Model", "ClassificationDetails.Dvla.Model"]);
  const model = range || dvlaModel || find(d, ["model"]);
  let variant = first(d, ["SmmtDetails.ModelVariant", "ClassificationDetails.Smmt.Trim", "SmmtDetails.Trim"]) || "";
  if (!variant && range && dvlaModel && String(dvlaModel).toUpperCase().startsWith(String(range).toUpperCase()))
    variant = String(dvlaModel).slice(String(range).length);
  const body = pick(d, ["SmmtDetails.BodyStyle", "VehicleRegistration.BodyStyle", "TechnicalDetails.General.BodyStyle"], ["bodystyle", "bodytype"]);
  const cls = String(pick(d, ["VehicleRegistration.VehicleClass", "SmmtDetails.VehicleClass", "VehicleRegistration.TaxationClass"], ["vehicleclass", "vehicletype", "taxationclass"]) || "").toUpperCase();
  const bodyU = String(body || "").toUpperCase();
  const kind = /VAN|PICK|LCV|GOODS|COMMERCIAL|CHASSIS|TIPPER|LUTON/.test(bodyU + " " + cls) ? "Van" : "Car";
  const firstReg = isoDate(pick(d, ["VehicleRegistration.DateFirstRegistered", "VehicleRegistration.DateFirstRegisteredUk"], ["datefirstregistered", "datefirstregistereduk"]));
  const yom = pick(d, ["VehicleRegistration.YearOfManufacture"], ["yearofmanufacture", "manufactureyear"]);
  const year = Number(String(yom || firstReg || "").slice(0, 4)) || null;
  const ccRaw = pick(d, ["VehicleRegistration.EngineCapacity", "SmmtDetails.EngineCapacity", "TechnicalDetails.General.Engine.EngineCapacity"], ["enginecapacity", "enginecc", "cylindercapacity"]);
  const cc = Number(String(ccRaw || "").replace(/[^0-9]/g, "")) || null;
  let mot = isoDate(pick(d, ["VehicleStatus.MotVed.MotDue", "VehicleStatus.NextMotDueDate", "MotHistory.RecordList.0.ExpiryDate"], ["motdue", "motduedate", "nextmotduedate", "motexpirydate", "motexpiry"]));
  const tax = isoDate(pick(d, ["VehicleStatus.MotVed.VedExpiryDate"], ["vedexpirydate", "taxduedate", "taxexpirydate"]));
  let firstMot = false;
  if (!mot && firstReg) {
    // a new vehicle's first MOT is due on the third anniversary of first registration
    const due = new Date(firstReg);
    due.setFullYear(due.getFullYear() + 3);
    if (due > new Date()) {
      mot = due.toISOString().slice(0, 10);
      firstMot = true;
    }
  }
  const tyre = pick(d, ["TyreDetails.RecordList.0.Front.Tyre.SizeDescription", "TechnicalDetails.Dimensions.TyreSizeFront"], ["tyresizefront", "fronttyresize", "sizedescription"]);

  return {
    reg,
    kind,
    make: title(make),
    model: title(model),
    variant: title(variant).replace(/^[-\s]+/, ""),
    fuel: fuel(pick(d, ["VehicleRegistration.FuelType", "SmmtDetails.FuelType"], ["fueltype", "fuel"])),
    gear: gear(pick(d, ["VehicleRegistration.TransmissionType", "VehicleRegistration.Transmission", "SmmtDetails.Transmission"], ["transmissiontype", "transmission", "gearbox"])),
    body: title(body),
    col: title(pick(d, ["VehicleRegistration.Colour", "VehicleRegistration.Color"], ["colour", "color"])),
    year,
    cc,
    mot,
    firstMot,
    tax,
    tyre: clean(tyre) || null,
    live: true,
  };
}

/* ---------- the handler ---------- */

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "method" });
  const key = process.env.VDG_API_KEY;
  const url = new URL(req.url, "http://x");

  // the site asks once on load whether live look-ups are switched on (free, no call to the provider)
  if (url.searchParams.has("probe")) return send(res, 200, { live: !!key }, "no-store");
  if (!key) return send(res, 503, { error: "not_configured" });
  if (!sameSite(req)) return send(res, 403, { error: "forbidden" });

  const reg = String(url.searchParams.get("reg") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!REG_RE.test(reg)) return send(res, 400, { error: "bad_reg", message: "Enter a full UK registration." });

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  if (limited(ip)) return send(res, 429, { error: "too_many", message: "Too many look-ups. Please wait a few minutes." });

  const base = (process.env.VDG_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const pkg = process.env.VDG_PACKAGE || "VehicleData";
  const api =
    `${base}/${encodeURIComponent(pkg)}?v=2&api_nullitems=1` +
    `&auth_apikey=${encodeURIComponent(key)}&key_VRM=${encodeURIComponent(reg)}`;

  let j;
  try {
    const r = await fetch(api, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    j = await r.json();
  } catch (e) {
    console.error("VRM look-up: provider unreachable", e && e.name);
    return send(res, 502, { error: "provider", message: "The vehicle check is not available right now." });
  }

  const resp = j && (j.Response || j.response);
  const code = String((resp && (resp.StatusCode || resp.statusCode)) || "");
  if (code !== "Success") {
    if (/notfound|nomatch|noresult|itemnotfound|vrmnotfound|novehicle/i.test(code))
      return send(res, 404, { error: "not_found" }, "public, s-maxage=3600");
    console.error("VRM look-up: provider said", code, resp && resp.StatusMessage);
    return send(res, 502, { error: "provider", code, message: "The vehicle check is not available right now." });
  }

  const vehicle = normalise(reg, resp.DataItems || resp.dataItems || {});
  if (!vehicle.make) return send(res, 404, { error: "not_found" }, "public, s-maxage=3600");
  // the same registration asked again within a day is answered from Vercel's cache, at no extra cost
  return send(res, 200, { vehicle }, "public, s-maxage=86400");
};
