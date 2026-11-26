// Vercel serverless function: live registration look-up.
// Two sources, both optional. Their keys live only in Vercel environment variables, never in the page:
//   DVLA_API_KEY  the DVLA Vehicle Enquiry Service (free, official): make, colour, fuel, year, engine size, CO2,
//                 MOT expiry, tax status, car or van. It has NO model, variant, gearbox or body type.
//                 DVLA_ENV=test uses DVLA's test service instead (only DVLA's own test registrations work there).
//   VDG_API_KEY   Vehicle Data Global (paid, a few pence a look-up): adds the model, variant, gearbox, body and mpg.
//                 Optional: VDG_ENDPOINT, VDG_PACKAGE (default VehicleDetails), VDG_DEBUG=1 (raw answer view).
// When both are set, both are asked at once and the answers are joined: the DVLA wins for the official facts.
// ?basic=1 asks the DVLA only (free), for pages that do not need the model.
//
// Safeguards:
// - only this site's own pages may use it (requests from other websites are refused)
// - each visitor may make 150 look-ups per 10 minutes, and 20 of them may use the paid source; after that the
//   answer comes from the DVLA alone
// - each registration's answer is kept in Vercel's cache for a day, so asking again is free
const ENDPOINT = process.env.VDG_ENDPOINT || 'https://uk.api.vehicledataglobal.com/r2/lookup';
const PACKAGE = process.env.VDG_PACKAGE || 'VehicleDetails';
const DVLA_LIVE = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const DVLA_TEST = 'https://uat.driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';

const WINDOW = 10 * 60 * 1000;
function counter(limit) {
  const hits = new Map();
  return {
    over(ip) { const now = Date.now(); return (hits.get(ip) || []).filter(t => now - t < WINDOW).length >= limit; },
    add(ip) { const now = Date.now(); const h = (hits.get(ip) || []).filter(t => now - t < WINDOW); h.push(now); hits.set(ip, h); if (hits.size > 5000) hits.clear(); }
  };
}
const ALL = counter(150), PAID = counter(20);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function send(res, status, body, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(body));
}

// Browsers say where a request comes from; only our own pages are allowed.
function sameSite(req) {
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const from = String(req.headers.origin || req.headers.referer || '');
  if (!from) return false;
  try { return new URL(from).host === host; } catch (e) { return false; }
}

// Walk the response and find the first non-empty value whose key matches one of the names.
function find(obj, names) {
  const want = names.map(n => n.toLowerCase());
  const queue = [obj];
  let seen = 0;
  while (queue.length && seen++ < 5000) {
    const o = queue.shift();
    if (!o || typeof o !== 'object') continue;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (want.includes(k.toLowerCase()) && v != null && typeof v !== 'object' && String(v).trim() !== '') return v;
    }
    for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') queue.push(o[k]);
  }
  return null;
}
// strip anything that could break the page, then tidy the capitals
const clean = s => s == null ? '' : String(s).replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
const UPPER = new Set(['BMW', 'MG', 'VW', 'DS', 'SEAT', 'LDV', 'LEVC', 'DAF', 'BYD', 'JCB', 'GTI', 'TDI', 'TSI', 'TFSI', 'AMG', 'SE', 'GT', 'ST', 'RS', 'HDI', 'CDI', 'DCI', 'TDCI', 'LWB', 'SWB', 'MWB', 'EV', 'PHEV', 'XL', 'LE', 'SR', 'AWD', '4WD', '4X4', 'DSG', 'CVT']);
const title = s => {
  const c = clean(s);
  if (!c) return null;
  return c.split(' ').map(w => UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w.toLowerCase().replace(/\b[a-z]/g, ch => ch.toUpperCase())).join(' ');
};

// DVLA and other sources word fuel differently: diesel is often recorded as "HEAVY OIL", and some
// answers give codes. Anything we cannot read with confidence is left out, so the seller chooses it.
function normFuel(f) {
  if (!f) return null;
  const s = String(f).toLowerCase().trim();
  if (s.includes('hybrid') || /\b(phev|hev|mhev)\b/.test(s) || (s.includes('electric') && (s.includes('diesel') || s.includes('petrol')))) return 'Hybrid';
  if (s.includes('diesel') || s.includes('heavy oil') || s.includes('derv') || s === 'd' || s === 'hvo') return 'Diesel';
  if (s.includes('electric') || s === 'ev' || s === 'bev' || s === 'e') return 'Electric';
  if (s.includes('petrol') || s.includes('gasoline') || s.includes('unleaded') || s === 'p') return 'Petrol';
  return null;
}
function normGear(g) {
  if (!g) return null;
  const s = String(g).toLowerCase();
  if (s.includes('auto') || s.includes('cvt') || s.includes('dsg') || s.includes('semi')) return 'Automatic';
  if (s.includes('man')) return 'Manual';
  return title(g);
}
function isoDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return null;
}

// ---------- Vehicle Data Global (paid) ----------
async function askVdg(reg, key) {
  const url = ENDPOINT + '?packageName=' + encodeURIComponent(PACKAGE) +
    '&apiKey=' + encodeURIComponent(key) + '&vrm=' + encodeURIComponent(reg);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch (e) { j = null; }
    if (!r.ok || !j) return { error: 'vdg_' + r.status };
    return { raw: j };
  } catch (e) { return { error: 'vdg_timeout' }; } finally { clearTimeout(t); }
}
function shapeVdg(reg, j) {
  const make = find(j, ['make', 'dvlaMake', 'vehicleMake']);
  if (!make) return null;
  const body = find(j, ['bodyStyle', 'bodyType', 'body']);
  const cls = String(find(j, ['vehicleClass', 'vehicleType', 'taxationClass']) || '');
  const firstReg = isoDate(find(j, ['dateFirstRegistered', 'dateFirstRegisteredUk', 'firstRegistrationDate']));
  let mot = isoDate(find(j, ['motDueDate', 'motExpiryDate', 'motDue', 'nextMotDueDate']));
  let firstMot = false;
  if (!mot && firstReg) {
    // a new vehicle's first MOT is due on the third anniversary of its first registration
    const due = new Date(firstReg);
    due.setFullYear(due.getFullYear() + 3);
    if (due > new Date()) { mot = due.toISOString().slice(0, 10); firstMot = true; }
  }
  const model = title(find(j, ['model', 'dvlaModel', 'vehicleModel'])) || '';
  let variant = title(find(j, ['modelVariant', 'variant', 'trim', 'series'])) || '';
  // some answers already include the trim in the model name: don't repeat it
  if (variant && model.toLowerCase().includes(variant.toLowerCase())) variant = '';
  const out = {
    reg,
    kind: /van|pick|lcv|goods|commercial|chassis|tipper|luton/i.test((body || '') + ' ' + cls) ? 'Van' : 'Car',
    make: title(make),
    model,
    variant,
    year: +(find(j, ['yearOfManufacture', 'manufactureYear', 'yearOfRegistration', 'year']) || String(firstReg || '').slice(0, 4) || 0) || null,
    fuel: normFuel(find(j, ['dvlaFuelType', 'fuelType', 'fuelTypeDescription', 'fuelDescription', 'engineFuelType', 'primaryFuelType', 'fuel'])),
    gear: normGear(find(j, ['transmissionType', 'transmission', 'gearbox'])),
    body: title(body),
    col: title(find(j, ['colour', 'color', 'primaryColour'])),
    mot,
    firstMot,
    cc: +(find(j, ['engineCapacity', 'engineCapacityCc', 'cylinderCapacity']) || 0) || null,
    co2: (function (v) { v = parseFloat(v); return isFinite(v) && v >= 0 && v < 1000 ? Math.round(v) : null; })(find(j, ['co2Emissions', 'co2', 'co2Emission', 'co2EmissionsGkm', 'co2gkm'])),
    firstReg: firstReg || null,
    mpg: (function (v) { v = parseFloat(v); return isFinite(v) && v > 5 && v < 300 ? Math.round(v * 10) / 10 : null; })(find(j, ['combinedMpg', 'mpgCombined', 'fuelConsumptionCombinedMpg']))
  };
  return out;
}

// ---------- DVLA Vehicle Enquiry Service (free, official) ----------
async function callDvla(url, reg, key) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    return await fetch(url, { method: 'POST', signal: ctl.signal, body: JSON.stringify({ registrationNumber: reg }),
      headers: { 'x-api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' } });
  } finally { clearTimeout(t); }
}
async function askDvla(reg, key) {
  const url = process.env.DVLA_ENV === 'test' ? DVLA_TEST : DVLA_LIVE;
  try {
    for (let tries = 0; tries < 3; tries++) {
      const r = await callDvla(url, reg, key);
      // too many requests at once (the DVLA allows only a few a second): wait a moment and try again
      if (r.status === 429 || r.status === 503) { await sleep(700 * (tries + 1)); continue; }
      if (r.status === 404 || r.status === 400) return { notFound: true };
      if (r.status === 403 && url === DVLA_LIVE) {
        // refused: either the key is wrong, or it is a key for DVLA's test service. Ask the test service once so the
        // reason can be told apart. Test answers are never shown to visitors.
        const u = await callDvla(DVLA_TEST, reg, key).catch(() => null);
        return { error: u && (u.ok || u.status === 404 || u.status === 400) ? 'dvla_test_key' : 'dvla_key_refused' };
      }
      const text = await r.text();
      let j; try { j = JSON.parse(text); } catch (e) { j = null; }
      if (!r.ok || !j || !j.make) return { error: 'dvla_' + r.status };
      return { raw: j };
    }
    return { error: 'dvla_busy' };
  } catch (e) { return { error: 'dvla_timeout' }; }
}
function shapeDvla(reg, v) {
  const ta = String(v.typeApproval || '').toUpperCase();
  const firstReg = /^\d{4}-\d{2}$/.test(String(v.monthOfFirstRegistration || '')) ? v.monthOfFirstRegistration + '-01' : null;
  let mot = isoDate(v.motExpiryDate), firstMot = false;
  if (!mot && firstReg) {
    // a new vehicle's first MOT is due on the third anniversary of its first registration
    const due = new Date(firstReg);
    due.setFullYear(due.getFullYear() + 3);
    if (due > new Date()) { mot = due.toISOString().slice(0, 10); firstMot = true; }
  }
  const num = (x, lo, hi) => { const n = parseFloat(x); return isFinite(n) && n >= lo && n < hi ? Math.round(n) : null; };
  return {
    reg,
    // type approval: M1 is a car, N1 to N3 are goods vehicles (vans and pick-ups)
    kind: /^N/.test(ta) ? 'Van' : /^M1/.test(ta) ? 'Car' : null,
    make: title(v.make),
    model: '',
    variant: '',
    year: num(v.yearOfManufacture, 1900, 2100) || num(String(firstReg || '').slice(0, 4), 1900, 2100),
    fuel: normFuel(v.fuelType),
    gear: null,
    body: null,
    col: title(v.colour),
    mot,
    firstMot,
    cc: num(v.engineCapacity, 1, 20000),
    co2: num(v.co2Emissions, 0, 1000),
    firstReg,
    // official facts only the DVLA gives
    tax: title(v.taxStatus) || null,
    taxDue: isoDate(v.taxDueDate),
    motStatus: clean(v.motStatus) || null,
    grossKg: num(v.revenueWeight, 1, 100000),
    euro: clean(v.euroStatus) || null,
    exported: v.markedForExport === true,
    v5cDate: isoDate(v.dateOfLastV5CIssued)
  };
}
// join the two answers: the DVLA's official facts win, the paid source adds what the DVLA does not hold
function join(d, p) {
  if (!d) return p;
  if (!p) return d;
  const o = Object.assign({}, p);
  for (const k of ['year', 'fuel', 'col', 'mot', 'firstMot', 'cc', 'co2', 'firstReg', 'kind']) if (d[k] != null && d[k] !== '') o[k] = d[k];
  if (!o.make) o.make = d.make;
  for (const k of ['tax', 'taxDue', 'motStatus', 'grossKg', 'euro', 'exported', 'v5cDate']) o[k] = d[k];
  return o;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'method' });
  const q = new URL(req.url, 'http://x').searchParams;
  const vdgKey = process.env.VDG_API_KEY, dvlaKey = process.env.DVLA_API_KEY;
  // the page asks once whether live look-ups are switched on (free: no call to either source)
  if (q.has('probe')) return send(res, 200, { ok: true, live: !!(vdgKey || dvlaKey), dvla: !!dvlaKey, vdg: !!vdgKey });
  const reg = String(q.get('reg') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (reg.length < 2 || reg.length > 8) return send(res, 400, { ok: false, error: 'bad_reg' });
  if (!vdgKey && !dvlaKey) return send(res, 503, { ok: false, error: 'not_configured' });
  if (!sameSite(req)) return send(res, 403, { ok: false, error: 'forbidden' });
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
  if (ALL.over(ip)) return send(res, 429, { ok: false, error: 'too_many' });
  ALL.add(ip);
  const debug = q.get('debug') === '1' && process.env.VDG_DEBUG === '1';
  // the paid source: not for basic look-ups, and only 20 per visitor in 10 minutes
  // (without a DVLA key, basic=1 is ignored: the paid source is the only one)
  const usePaid = !!vdgKey && (!dvlaKey || debug || q.get('basic') !== '1') && !PAID.over(ip);
  if (!dvlaKey && !usePaid) return send(res, 429, { ok: false, error: 'too_many' });
  if (usePaid) PAID.add(ip);
  const [D, P] = await Promise.all([dvlaKey ? askDvla(reg, dvlaKey) : null, usePaid ? askVdg(reg, vdgKey) : null]);
  if (debug && P && P.raw) return send(res, 200, { ok: true, raw: P.raw, dvla: D && (D.raw || D) });
  const d = D && D.raw ? shapeDvla(reg, D.raw) : null;
  const p = P && P.raw ? shapeVdg(reg, P.raw) : null;
  const out = join(d, p);
  const notes = {};
  if (D && D.error) notes.dvlaError = D.error;
  if (P && P.error) notes.paidError = P.error;
  if (out) {
    out.src = [d ? 'dvla' : '', p ? 'paid' : ''].filter(Boolean).join('+');
    // an answer with every source that was asked is kept for a day; a partial one is not kept
    const whole = (!dvlaKey || d) && (!usePaid || p);
    return send(res, 200, Object.assign({ ok: true, data: out }, notes), whole ? 'public, s-maxage=86400' : 'no-store');
  }
  // no answer: "not found" only when every source that answered said so
  const missing = (!D || D.notFound) && (!P || (P.raw && !p));
  if (missing && (D || P)) return send(res, 404, { ok: false, error: 'not_found' }, 'public, s-maxage=3600');
  return send(res, 502, Object.assign({ ok: false, error: 'upstream' }, notes));
};
