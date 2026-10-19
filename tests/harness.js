/* Loads the browser scripts (js/*.js) into a Node vm context with a minimal
 * DOM / localStorage / Supabase stub, so their top-level functions can be
 * unit-tested without a browser. Top-level let/const/function declarations
 * are reachable through ctx.run('name'). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function fakeElement(id) {
  let value = '';
  return {
    get value() { return value; }, set value(v) { value = v == null ? '' : String(v); },  // inputs coerce like the DOM
    id, textContent: '', innerHTML: '', checked: false, hidden: false, title: '',
    selectionStart: 0, style: { setProperty() {} }, dataset: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { const v = on === undefined ? !this._s.has(c) : on; v ? this._s.add(c) : this._s.delete(c); return v; },
      contains(c) { return this._s.has(c); } },
    appendChild() {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    focus() {}, setAttribute() {}, getAttribute() { return null; }, scrollIntoView() {}
  };
}

function createContext() {
  const els = {};
  const store = {};
  const listeners = {};
  const chain = () => { const res = { data: null, error: null };
    const c = new Proxy(function () {}, { get(_, k) { return k === 'then' ? (r) => Promise.resolve(res).then(r) : () => c; }, apply() { return c; } });
    return c; };
  const document = {
    getElementById: (id) => (els[id] = els[id] || fakeElement(id)),
    createElement: () => { const e = fakeElement(''); Object.defineProperty(e, 'innerHTML', { get() { return this.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }, set() {} }); return e; },
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    head: fakeElement('head'), body: fakeElement('body'), documentElement: fakeElement('html'),
    readyState: 'complete', visibilityState: 'visible', hidden: false
  };
  const sandbox = {
    console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    document, navigator: { onLine: true },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    addEventListener() {}, removeEventListener() {}, confirm: () => true, alert() {},
    fetch: async () => ({ ok: false }),
    location: { href: 'http://localhost/', protocol: 'http:' }
  };
  sandbox.window = sandbox;
  sandbox.supabase = { createClient: () => ({ from: chain, rpc: chain, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } }) };
  vm.createContext(sandbox);
  const ctx = {
    sandbox, els, store, listeners,
    load(...files) { for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f }); return ctx; },
    run(code) { return vm.runInContext(code, sandbox); },
    el: (id) => document.getElementById(id),
    fire(type, init) { (listeners[type] || []).forEach(fn => fn(Object.assign({ preventDefault() {}, stopPropagation() {} }, init))); }
  };
  return ctx;
}

/** The full app as index.html loads it. */
function loadApp() {
  return createContext().load('js/akatsuki-client.js', 'js/cal-adapter.js', 'js/app.js', 'js/sukkiri.js');
}

module.exports = { createContext, loadApp };
