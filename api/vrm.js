// Vercel serverless function: live registration look-up via Vehicle Data Global.
// The API key lives only in the Vercel environment variable VDG_API_KEY, never in the page.
// Optional: VDG_ENDPOINT (default below), VDG_PACKAGE (default VehicleDetails), VDG_DEBUG=1 (raw answer view).
//
// Safeguards, because every look-up costs a credit:
// - only this site's own pages may use it (requests from other websites are refused)
// - each visitor may make 20 look-ups per 10 minutes
// - each registration's answer is kept in Vercel's cache for a day, so asking again is free
const ENDPOINT = process.env.VDG_ENDPOINT || 'https://uk.api.vehicledataglobal.com/r2/lookup';
const PACKAGE = process.env.VDG_PACKAGE || 'VehicleDetails';

const hits = new Map();
const LIMIT = 20;
const WINDOW = 10 * 60 * 1000;
function limited(ip) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  h.push(now);
  hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.length > LIMIT;
}

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
const UPPER = new Set(['BMW', 'MG', 'VW', 'DS', 'GTI', 'TDI', 'TSI', 'TFSI', 'AMG', 'SE', 'GT', 'ST', 'RS', 'HDI', 'CDI', 'DCI', 'TDCI', 'LWB', 'SWB', 'MWB', 'EV', 'PHEV', 'XL', 'LE', 'SR', 'AWD', '4WD', '4X4', 'DSG', 'CVT']);
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

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'method' });
  const q = new URL(req.url, 'http://x').searchParams;
  const key = process.env.VDG_API_KEY;
  // the page asks once whether live look-ups are switched on (free: no call to Vehicle Data Global)
  if (q.has('probe')) return send(res, 200, { ok: true, live: !!key });
  const reg = String(q.get('reg') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (reg.length < 2 || reg.length > 8) return send(res, 400, { ok: false, error: 'bad_reg' });
  if (!key) return send(res, 503, { ok: false, error: 'not_configured' });
  if (!sameSite(req)) return send(res, 403, { ok: false, error: 'forbidden' });
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
  if (limited(ip)) return send(res, 429, { ok: false, error: 'too_many' });
  const debug = q.get('debug') === '1' && process.env.VDG_DEBUG === '1';
  try {
    const url = ENDPOINT + '?packageName=' + encodeURIComponent(PACKAGE) +
      '&apiKey=' + encodeURIComponent(key) + '&vrm=' + encodeURIComponent(reg);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch (e) { j = null; }
    if (!r.ok || !j) return send(res, 502, { ok: false, error: 'upstream_' + r.status });
    if (debug) return send(res, 200, { ok: true, raw: j });
    const make = find(j, ['make', 'dvlaMake', 'vehicleMake']);
    if (!make) return send(res, 404, { ok: false, error: 'not_found' }, 'public, s-maxage=3600');
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
    return send(res, 200, { ok: true, data: out }, 'public, s-maxage=86400');
  } catch (e) {
    return send(res, 504, { ok: false, error: 'timeout' });
  }
};
