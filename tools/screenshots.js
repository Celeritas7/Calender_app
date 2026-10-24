/* Screenshot set for design review.
 *
 *   node tools/screenshots.js [label]        → tools/shots/<label>/*.png   (label defaults to "current")
 *   APP_ROOT=<dir> node tools/screenshots.js  → shoot another checkout (e.g. a git worktree of an older commit)
 *
 * Needs Playwright (npm i -D playwright, or a global install on NODE_PATH).
 * Serves the repo itself on a free port, runs the app in guest mode with a stubbed
 * Supabase client (no network writes), and pins the clock so every run shows the
 * same month. Weather and holiday APIs are blocked so cells are deterministic.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.env.APP_ROOT || path.join(__dirname, '..'));
const LABEL = process.argv[2] || 'current';
const OUT = path.join(__dirname, 'shots', LABEL);   // always under this checkout's tools/
const FIXED_NOW = new Date('2026-10-19T09:00:00+09:00');
const THEMES = [[0, 'newsprint'], [2, 'terminal'], [6, 'solar'], [7, 'parchment'], [8, 'tokyo']];
const WEATHER_PLAN = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'weather-plan.json'), 'utf8'));
const TASKS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'tasks.json'), 'utf8')).tasks;
const VIEWPORTS = [['desk', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]];

const SUPABASE_STUB = `(function(){
  const res={data:null,error:null};
  function ch(){const c=new Proxy(function(){},{get(_,k){if(k==='then')return r=>Promise.resolve(res).then(r);return ()=>c},apply(){return c}});return c}
  window.supabase={createClient(){return {from:()=>ch(),rpc:()=>ch(),channel:()=>ch(),removeChannel(){},
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},
      signOut:async()=>({}),signInWithPassword:async()=>({error:{message:'stub'}}),signUp:async()=>({error:{message:'stub'}})}}}};
})();`;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function openApp(browser, base, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await page.clock.setFixedTime(FIXED_NOW);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: SUPABASE_STUB }));
  await page.route(/open-meteo|date\.nager/, r => r.abort());
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  /* freeze animations so two runs of the same code give identical images */
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  await page.waitForTimeout(900);
  return { page, errors };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  const report = [];
  try {
    for (const [vpName, vp] of VIEWPORTS) {
      const { page, errors } = await openApp(browser, base, vp);
      await page.screenshot({ path: path.join(OUT, `${vpName}-login.png`) });
      await page.evaluate(() => enterGuest());
      await page.waitForTimeout(1200);
      /* preview mode can't read the hub — inject a recorded akatsuki_weather plan row instead */
      await page.evaluate(plan => {
        weatherData = {}; plan.days.forEach(d => { weatherData[d.date] = hubDayToWx(d); });
        wxSeasons = plan.seasons; wxAttribution = plan.attribution; renderCal();
      }, WEATHER_PLAN);
      /* realistic Weekly Focus tasks — dated (in cells) and undated (No date yet panel) */
      await page.evaluate(tasks => { wfTasks = tasks; renderCal(); renderNoDate(); }, TASKS);
      const themeOverflow = [];
      for (const [idx, name] of THEMES) {
        await page.evaluate(i => applyTheme(i), idx);
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(OUT, `${vpName}-main-${name}.png`), fullPage: true });
        /* fonts differ per theme, so overflow must be checked in each one */
        const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (over > 0) themeOverflow.push(`${name} +${over}px`);
      }
      await page.evaluate(() => applyTheme(7));
      await page.evaluate(() => toggleWxView());
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(OUT, `${vpName}-weather-view.png`), fullPage: true });
      await page.evaluate(() => toggleWxView());
      await page.evaluate(() => { const k = dk(20); openModal(k, calData[k]); });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${vpName}-day-weather.png`) });
      await page.evaluate(() => closeModal());
      await page.evaluate(() => { const k = dk(11); openModal(k, calData[k]); });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${vpName}-day-editor.png`) });
      await page.evaluate(() => closeModal());
      for (const [fn, close, shot] of [['openBdayManager', 'closeBdayManager', 'birthdays'], ['openSukkiri', 'closeSukkiri', 'sukkiri'], ['openPicker', null, 'picker'], ['togglePrintOpts', 'togglePrintOpts', 'print']]) {
        await page.evaluate(f => window[f](), fn);
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, `${vpName}-${shot}.png`) });
        if (close) await page.evaluate(f => window[f](), close);
        else await page.evaluate(() => $('picker-ov').classList.add('hidden'));
      }
      if (await page.isVisible('#more-btn')) {   // phone toolbar menu
        await page.click('#more-btn');
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(OUT, `${vpName}-more-menu.png`) });
        await page.evaluate(() => closeAllDD());
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const worst = Math.max(overflow, ...themeOverflow.map(t => +t.match(/\+(\d+)px/)[1]));
      report.push(`${vpName}: horizontal overflow ${worst}px${themeOverflow.length ? ' (' + themeOverflow.join(', ') + ')' : ''}, page errors ${errors.length}${errors.length ? ' — ' + errors.join(' | ') : ''}`);
      await page.close();
    }
  } finally {
    await browser.close();
    srv.close();
  }
  console.log(`Saved to ${path.relative(process.cwd(), OUT)}/`);
  report.forEach(l => console.log('  ' + l));
  /* a page wider than the screen makes phones zoom out — treat it as a failure */
  if (report.some(l => !/overflow 0px, page errors 0$/.test(l))) { console.error('FAIL: horizontal overflow or page errors'); process.exitCode = 1; }
})().catch(e => { console.error(e); process.exit(1); });
