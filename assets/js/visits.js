// Visit counter: one count per device per day, shown in the footer.
// A random ID is kept in this browser only; no names, IPs or personal data are sent.
// The publishable key is meant to be public: the database only lets it call the two counting functions.
const URL_ = 'https://wxlpbefrbxxbosjfeudk.supabase.co/rest/v1/rpc';
const KEY = 'sb_publishable_N9SO6zdvGjgfggBDqfzjtA_es8fc9eU';
const SITE = 'tournament';
const ID_KEY = 'tsp-visitor-id';
const DAY_KEY = 'tsp-visit-day';

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

function deviceId() {
  let id = safe(() => localStorage.getItem(ID_KEY), null);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
    safe(() => localStorage.setItem(ID_KEY, id));
  }
  return id;
}

async function rpc(name, body) {
  const res = await fetch(`${URL_}/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`visits ${res.status}`);
  return res.json();
}

function paint(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n < 1) return;
  document.querySelectorAll('[data-visits]').forEach((el) => {
    el.querySelector('[data-visits-n]').textContent = n.toLocaleString('en-IN');
    el.hidden = false;
  });
}

async function run() {
  if (!document.querySelector('[data-visits]')) return;
  try {
    const counted = safe(() => localStorage.getItem(DAY_KEY), null) === today();
    const count = counted
      ? await rpc('get_site_visit_count', { p_site: SITE })
      : await rpc('record_site_visit', { p_site: SITE, p_device_id: deviceId(), p_path: location.pathname.slice(0, 200) || '/' });
    if (!counted) safe(() => localStorage.setItem(DAY_KEY, today()));
    paint(count);
  } catch {
    /* offline or blocked: the counter just stays hidden */
  }
}

run();
