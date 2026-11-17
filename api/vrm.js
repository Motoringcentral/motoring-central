// Vercel serverless function: live registration look-up via Vehicle Data Global.
// The API key lives only in the Vercel environment variable VDG_API_KEY, never in the page.
// Optional: VDG_ENDPOINT (default below), VDG_PACKAGE (default VehicleDetails).
const ENDPOINT = process.env.VDG_ENDPOINT || 'https://uk.api.vehicledataglobal.com/r2/lookup';
const PACKAGE = process.env.VDG_PACKAGE || 'VehicleDetails';

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
const title = s => s == null ? null : String(s).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

function normFuel(f) {
  if (!f) return null;
  const s = String(f).toLowerCase();
  if (s.includes('electric') && !s.includes('hybrid')) return 'Electric';
  if (s.includes('hybrid')) return 'Hybrid';
  if (s.includes('diesel')) return 'Diesel';
  if (s.includes('petrol')) return 'Petrol';
  return title(f);
}
function normGear(g) {
  if (!g) return null;
  const s = String(g).toLowerCase();
  if (s.includes('auto') || s.includes('cvt') || s.includes('dsg') || s.includes('semi')) return 'Automatic';
  if (s.includes('man')) return 'Manual';
  return title(g);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const reg = String((req.query && req.query.reg) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (reg.length < 2 || reg.length > 8) return res.status(400).json({ ok: false, error: 'bad_reg' });
  const key = process.env.VDG_API_KEY;
  if (!key) return res.status(503).json({ ok: false, error: 'not_configured' });
  try {
    const url = ENDPOINT + '?packageName=' + encodeURIComponent(PACKAGE) +
      '&apiKey=' + encodeURIComponent(key) + '&vrm=' + encodeURIComponent(reg);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch (e) { j = null; }
    if (!r.ok || !j) return res.status(502).json({ ok: false, error: 'upstream_' + r.status });
    const make = find(j, ['make', 'dvlaMake', 'vehicleMake']);
    if (!make) return res.status(404).json({ ok: false, error: 'not_found' });
    const body = find(j, ['bodyStyle', 'bodyType', 'body']);
    const out = {
      reg,
      make: title(make),
      model: title(find(j, ['model', 'dvlaModel', 'vehicleModel'])) || '',
      variant: find(j, ['modelVariant', 'variant', 'trim', 'series']) || '',
      year: +(find(j, ['yearOfManufacture', 'manufactureYear', 'yearOfRegistration', 'year']) || 0) || null,
      fuel: normFuel(find(j, ['fuelType', 'dvlaFuelType', 'fuel'])),
      gear: normGear(find(j, ['transmissionType', 'transmission', 'gearbox'])),
      body: title(body),
      col: title(find(j, ['colour', 'color', 'primaryColour'])),
      mot: String(find(j, ['motDueDate', 'motExpiryDate', 'motDue']) || '').slice(0, 10) || null,
      cc: +(find(j, ['engineCapacity', 'engineCapacityCc', 'cylinderCapacity']) || 0) || null
    };
    return res.status(200).json({ ok: true, data: out });
  } catch (e) {
    return res.status(504).json({ ok: false, error: 'timeout' });
  }
};
