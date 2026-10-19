/* ═══════════════ SUKKIRI — upcoming trash strip (calendar app add-on) ═══════════════
   Drop-in for the calendar app. Copy this file to  Calender_app/js/sukkiri-trash.js
   and add ONE line to index.html, right after the existing sukkiri.js script tag:

       <script src="js/sukkiri.js"></script>
       <script src="js/sukkiri-trash.js"></script>      <!-- add this -->

   It reads the same `sk` payload sukkiri.js already owns (calapp_sukkiri) and paints a
   next-4-collections strip above the month grid. Theme-token styled, so it follows all
   14 themes. No changes to sukkiri.js itself. */
(function () {
  const HOST_ID = 'sk-trash-strip';

  function nextCollections(limit) {
    /* sk is declared with `let` in sukkiri.js, so it lives in the shared script scope,
       NOT on window — reference it bare, guarded by typeof. */
    if (typeof skGarbageOn !== 'function' || typeof sk === 'undefined' || !sk || !sk.show) return [];
    const out = [], d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 21 && out.length < limit; i++) {
      const day = new Date(d.getTime() + i * 86400000);
      const cats = skGarbageOn(skKey(day));
      if (cats.length) out.push({ i, day, cats });
    }
    return out;
  }

  function card(c) {
    const soon = c.i === 0 ? 'today' : c.i === 1 ? 'tomorrow' : '';
    const when = c.i === 0 ? 'TODAY · OUT BY 8:30'
      : c.i === 1 ? 'TOMORROW · BAG IT TONIGHT'
      : c.day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
    const glyphs = c.cats.map(g => (g.icon && typeof skIconSvg === 'function'
      ? skIconSvg(g.icon, g.color, 'width="17" height="17"')
      : `<span style="color:${g.color}">${g.short || g.label}</span>`)).join('');
    const labels = c.cats.map(g => `<span style="color:${g.color}">${g.label}</span>`).join(' <i style="opacity:.5">·</i> ');
    return `<div class="sk-ts-card${soon ? ' sk-ts-' + soon : ''}">
      <div class="sk-ts-h">${glyphs}<b>${when}</b></div>
      <div class="sk-ts-l">${labels}</div>
    </div>`;
  }

  function css() {
    if (document.getElementById('sk-ts-css')) return;
    const s = document.createElement('style');
    s.id = 'sk-ts-css';
    s.textContent = `
#${HOST_ID}{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:8px;margin:0 0 12px;width:100%;max-width:840px;z-index:1}
/* phone: one swipeable row instead of a tall stack — today + tomorrow fill the width,
   the rest swipe in; the right edge fades while there is more to scroll */
@media (max-width:599px){
  #${HOST_ID}{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:6px;margin-bottom:8px;padding-bottom:2px;scrollbar-width:none}
  #${HOST_ID}.sk-ts-more{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent)}
  #${HOST_ID}::-webkit-scrollbar{display:none}
  #${HOST_ID} .sk-ts-card{flex:0 0 calc(50% - 3px);scroll-snap-align:start;padding:7px 10px;border-radius:12px}
  #${HOST_ID} .sk-ts-h{margin-bottom:2px}
  #${HOST_ID} .sk-ts-h b{font-size:10px}
  #${HOST_ID} .sk-ts-l{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
}
#${HOST_ID}:empty{display:none}
#${HOST_ID} .sk-ts-card{background:var(--card-bg);border:1.5px solid var(--border);border-radius:14px;padding:10px 12px}
#${HOST_ID} .sk-ts-today{border-color:var(--accent)}
#${HOST_ID} .sk-ts-tomorrow{border-style:dashed}
#${HOST_ID} .sk-ts-h{display:flex;align-items:center;gap:6px;margin-bottom:5px}
#${HOST_ID} .sk-ts-h svg{width:17px;height:17px;flex-shrink:0}
#${HOST_ID} .sk-ts-h b{font-family:var(--b-font);font-size:11px;font-weight:800;letter-spacing:.05em;color:var(--txt2)}
#${HOST_ID} .sk-ts-today .sk-ts-h b{color:var(--accent)}
#${HOST_ID} .sk-ts-l{font-family:var(--b-font);font-size:13px;font-weight:700;color:var(--txt);line-height:1.45}
@media print{#${HOST_ID}{display:none}}`;
    document.head.appendChild(s);
  }

  function render() {
    const grid = document.getElementById('cal-grid');
    if (!grid) return;
    css();
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      grid.parentNode.insertBefore(host, grid);
    }
    const rows = nextCollections(4);
    host.innerHTML = rows.map(card).join('');
    fadeIfMore(host);
    if (!host.__skts) { host.__skts = true; host.addEventListener('scroll', () => fadeIfMore(host), { passive: true }); }
    if (!rows.length) console.warn('[sukkiri-trash] no collections found — check that garbage days are set in the Sukkiri overlay.');
  }

  /* fade the right edge only while more cards are off-screen */
  function fadeIfMore(host) {
    host.classList.toggle('sk-ts-more', host.scrollWidth - host.clientWidth - host.scrollLeft > 4);
  }

  /* repaint whenever sukkiri data or the grid changes */
  function hook(name) {
    const fn = window[name];
    if (typeof fn !== 'function' || fn.__skts) return;
    const wrapped = function () { const r = fn.apply(this, arguments); try { render(); } catch (e) {} return r; };
    wrapped.__skts = true;
    window[name] = wrapped;
  }

  function boot() {
    render();
    hook('saveSukkiri');
    hook('renderCal');
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    window.addEventListener('storage', e => { if (e.key === 'calapp_sukkiri') render(); });
    setInterval(render, 10 * 60 * 1000); /* rolls over at midnight */
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 400));
  else setTimeout(boot, 400);
})();
