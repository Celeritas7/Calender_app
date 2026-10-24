/* Phase 7 — health-risk weather read from the Akatsuki hub (R046, view akatsuki_weather). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');

/* trimmed copy of the live key=plan row, 2026-10-24 */
const PLAN = {
  key: 'plan', attribution: 'Weather data by Open-Meteo.com (CC BY 4.0)',
  seasons: [{ id: 'autumn', label: '秋の寒暖差 · ragweed · dry air begins', from: '2026-09-20', to: '2026-11-30' }],
  days: [
    { date: '2026-10-24', at: 'here', code: 63, tmax_c: 15.6, tmin_c: 14.3, precip_mm: 16.2, precip_prob_pct: 80,
      rh_mean_pct: 94, pressure_hpa_mean: 1023.2, pressure_d24_hpa: -4.1, feels_max_c: 16.8,
      change: { summary: 'cooler -4.4 °C · pressure -4.1 hPa · more humid' }, risk: [] },
    { date: '2026-10-25', at: 'home', code: 3, tmax_c: 23.1, tmin_c: 15, precip_mm: 0, precip_prob_pct: 5,
      rh_mean_pct: 70, pressure_hpa_mean: 1016.1, pressure_d24_hpa: -7.1, feels_max_c: 23.5,
      change: { summary: 'warmer +7.5 °C · pressure -7.1 hPa' },
      risk: [{ id: 'temp_swing', level: 'high', reason: 'Temperature +7.5 °C vs the day before' },
             { id: 'pressure_fall', level: 'watch', reason: 'Pressure -7.1 hPa vs the day before' }] },
    { date: '2026-10-26', at: 'office', code: 65, tmax_c: 18.4, tmin_c: 14, precip_mm: 57.9, precip_prob_pct: 95,
      change: { summary: 'similar to the day before' },
      risk: [{ id: 'storm', level: 'watch', reason: 'Heavy rain (57.9 mm)' }] }
  ]
};

function signedIn(rows, seen) {
  const app = loadApp();
  app.run('GUEST=false;UID="u-1";curYear=2026;curMonth=9');
  app.sandbox.__rows = rows; app.sandbox.__seen = seen || {};
  app.run(`sb.from=(t)=>{__seen.table=t;const q={select(c){__seen.select=c;return q},
    eq(c,v){(__seen.eq=__seen.eq||[]).push([c,v]);return q},
    in(c,v){__seen.in=[c,v];return Promise.resolve({data:__rows,error:null})}};return q}`);
  return app;
}

test('signed in: weather is read from the hub plan row, filtered to this user', async () => {
  const seen = {};
  const app = signedIn([PLAN], seen);
  let fetched = false; app.sandbox.fetch = async () => { fetched = true; return { ok: false }; };
  await app.run('loadWeather()');
  assert.equal(seen.table, 'akatsuki_weather');
  assert.equal(JSON.stringify(seen.eq), JSON.stringify([['user_id', 'u-1']]));
  assert.equal(fetched, false, 'no second, per-app forecast fetch when signed in');
  assert.equal(app.run(`weatherData['2026-10-25'].tMax`), 23);
  assert.equal(app.run(`weatherData['2026-10-26'].at`), 'office');
  assert.equal(app.run('wxSeasons.length'), 1);
});

test('the plan row wins over place:home; place:home is the fallback', async () => {
  const home = { key: 'place:home', days: [{ date: '2026-10-24', code: 0, tmax_c: 30, tmin_c: 20 }], seasons: [] };
  let app = signedIn([home, PLAN]);
  await app.run('loadWeather()');
  assert.equal(app.run(`weatherData['2026-10-24'].tMax`), 16);
  app = signedIn([home]);
  await app.run('loadWeather()');
  assert.equal(app.run(`weatherData['2026-10-24'].tMax`), 30);
});

test('no hub row means no forecast — not a stale or second copy', async () => {
  const app = signedIn([]);
  app.sandbox.fetch = async () => { throw new Error('must not fetch'); };
  await app.run('loadWeather()');
  assert.equal(app.run('Object.keys(weatherData).length'), 0);
});

test('preview mode falls back to Open-Meteo at Minami-Urawa station, never the old Chiba point', async () => {
  const app = loadApp();
  app.run('GUEST=true;UID="guest"');
  let url = '';
  app.sandbox.fetch = async (u) => { url = u; return { ok: true, json: async () => ({ daily: { time: ['2026-10-24'], weathercode: [1], temperature_2m_max: [19.4], temperature_2m_min: [11.9] } }) }; };
  await app.run('loadWeather()');
  assert.match(url, /latitude=35\.8461&longitude=139\.6203/);
  assert.doesNotMatch(url, /140\.06/);
  assert.equal(app.run(`weatherData['2026-10-24'].risk.length`), 0);
});

test('riskLevel: high beats watch; no risk → null', () => {
  const app = loadApp();
  const toWx = app.run('hubDayToWx'), level = app.run('riskLevel');
  assert.equal(level(toWx(PLAN.days[0])), null);
  assert.equal(level(toWx(PLAN.days[1])), 'high');
  assert.equal(level(toWx(PLAN.days[2])), 'watch');
  assert.equal(level(undefined), null);
});

test('calendar cells carry the health-risk marker with its reasons', async () => {
  const app = signedIn([PLAN]);
  await app.run('loadWeather()');
  app.run('renderCal()');
  const html = app.el('cells').innerHTML;
  assert.match(html, /hr-mark hr-high[^>]*aria-label="Health-risk weather: Temperature \+7\.5 °C vs the day before · Pressure -7\.1 hPa vs the day before"/);
  assert.match(html, /hr-mark hr-watch[^>]*Heavy rain \(57\.9 mm\)/);
  // each flagged day carries it twice: on the small icon (normal view) and the big icon (weather view)
  assert.equal((html.match(/class="hr-mark /g) || []).length, 4, 'only the two flagged days');
});

test('day editor shows place, humidity, pressure change, change summary, risks and seasons', async () => {
  const app = signedIn([PLAN]);
  await app.run('loadWeather()');
  const html = app.run(`wxDayHtml('2026-10-25', weatherData['2026-10-25'])`);
  assert.match(html, /23°C<\/b> \/ 15°C/);
  assert.match(html, /· Home/);
  assert.match(html, /humidity 70%/);
  assert.match(html, /1016 hPa \(-7\.1\)/);
  assert.match(html, /vs day before: warmer \+7\.5 °C/);
  assert.match(html, /hr-high[^<]*<\/span><span>Temperature \+7\.5 °C vs the day before<span class="wx-lvl"> · high/);
  assert.match(html, /秋の寒暖差/);
});

test('a day with no forecast still shows the seasons covering it', async () => {
  const app = signedIn([PLAN]);
  await app.run('loadWeather()');
  const html = app.run(`wxDayHtml('2026-11-20', undefined)`);
  assert.match(html, /秋の寒暖差/);
  assert.equal(app.run(`wxDayHtml('2026-12-20', undefined)`), '');
});

test('the season band lists every season overlapping the month on screen, and credits Open-Meteo', async () => {
  const app = signedIn([Object.assign({}, PLAN, { seasons: PLAN.seasons.concat([{ id: 'dry_flu', label: '乾燥 · flu season', from: '2026-12-01', to: '2027-02-28' }]) })]);
  await app.run('loadWeather()');
  app.run('renderCal()');
  assert.match(app.el('wx-season').innerHTML, /秋の寒暖差/);
  assert.doesNotMatch(app.el('wx-season').innerHTML, /flu season/, 'December season not shown in October');
  assert.equal(app.el('wx-attr').textContent, 'Weather data by Open-Meteo.com (CC BY 4.0)');
  app.run('curMonth=11'); app.run('renderCal()');
  assert.match(app.el('wx-season').innerHTML, /flu season/);
  assert.doesNotMatch(app.el('wx-season').innerHTML, /秋の寒暖差/);
});
