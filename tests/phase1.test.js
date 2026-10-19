/* Regression tests for the Phase 1 behaviour bugs (see PHASES.md). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');

const settle = () => new Promise(r => setImmediate(r));

test('reopening a diary entry and saving keeps every line mood', async () => {
  const app = loadApp();
  app.run('GUEST=true;UID="guest"');
  const key = app.run('dk(5)');
  const diary = '-bad line\n+good line\n~neutral line';
  app.run(`calData['${key}']={marked:false,markColor:'red',isGoal:false,note:'',diary:${JSON.stringify(diary)}}`);
  app.el('inp-diary').selectionStart = 'bad line\ngood line\nneutral line'.length; // caret at the end, as a browser leaves it
  app.run(`openModal('${key}',calData['${key}'])`);
  await app.run('saveModal()');
  assert.equal(app.run(`calData['${key}'].diary`), diary);
});

test('editing text inside an existing diary line keeps that line\'s mood', () => {
  const app = loadApp();
  const ta = app.el('inp-diary');
  app.sandbox.__d = app.run('decodeDiary')('-bad line\n+good line');
  app.run(`diaryLineMoods=__d.moods;diaryLines=__d.text.split(String.fromCharCode(10));diaryMood='good'`);
  ta.value = 'bad line fixed\ngood line';
  ta.selectionStart = 'bad line fixed'.length;
  app.run('diaryInput()');
  assert.equal(app.run('encodeDiary()'), '-bad line fixed\n+good line');
});

test('a new diary line takes the current ink colour; inserting mid-text does not shift moods', () => {
  const app = loadApp();
  const ta = app.el('inp-diary');
  app.sandbox.__d = app.run('decodeDiary')('-first\n+last');
  app.run(`diaryLineMoods=__d.moods;diaryLines=__d.text.split(String.fromCharCode(10));diaryMood='neutral'`);
  ta.value = 'first\ninserted\nlast';
  ta.selectionStart = 'first\ninserted'.length;
  app.run('diaryInput()');
  assert.equal(app.run('encodeDiary()'), '-first\n~inserted\n+last');
});

test('arrow keys do not change month while typing in a field', () => {
  const app = loadApp();
  ['modal-ov', 'bday-ov', 'picker-ov', 'sk-ov'].forEach(id => app.el(id).classList.add('hidden'));
  const before = app.run('curMonth');
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
    app.fire('keydown', { key: 'ArrowLeft', target: { tagName: tag, isContentEditable: false } });
  }
  assert.equal(app.run('curMonth'), before);
});

test('arrow keys do not change month while the Sukkiri or print panel is open', () => {
  const app = loadApp();
  const before = app.run('curMonth');
  app.el('sk-ov').classList.remove('hidden');
  app.el('modal-ov').classList.add('hidden'); app.el('bday-ov').classList.add('hidden'); app.el('picker-ov').classList.add('hidden');
  app.fire('keydown', { key: 'ArrowRight', target: { tagName: 'BODY' } });
  assert.equal(app.run('curMonth'), before);
  app.el('sk-ov').classList.add('hidden');
  app.el('pr-opts').classList.add('open');
  app.fire('keydown', { key: 'ArrowRight', target: { tagName: 'BODY' } });
  assert.equal(app.run('curMonth'), before);
});

test('arrow keys still change month on the plain calendar', () => {
  const app = loadApp();
  ['modal-ov', 'bday-ov', 'picker-ov', 'sk-ov'].forEach(id => app.el(id).classList.add('hidden'));
  const before = app.run('curMonth');
  app.fire('keydown', { key: 'ArrowRight', target: { tagName: 'BODY' } });
  assert.equal(app.run('curMonth'), (before + 1) % 12);
});

test('Escape leaves bulk-mark mode and does not reload when the picker is closed', () => {
  const app = loadApp();
  let loads = 0;
  app.sandbox.__count = () => loads++;
  app.run('const __orig=loadAndRender;loadAndRender=async function(){__count();}');
  app.el('picker-ov').classList.add('hidden');
  app.run('bulkMode=true');
  app.fire('keydown', { key: 'Escape', target: { tagName: 'BODY' } });
  assert.equal(app.run('bulkMode'), false);
  assert.equal(loads, 0);
});

function fillBday(app, name, day, month, year) {
  app.el('bday-name').value = name; app.el('bday-day').value = String(day);
  app.el('bday-month').value = String(month); app.el('bday-year').value = year == null ? '' : String(year);
}

test('impossible birthday dates are rejected with a readable message', async () => {
  const app = loadApp();
  fillBday(app, 'Aki', 31, 2, 1990);
  await app.run('addBday()');
  assert.match(app.el('bday-msg').textContent, /February has only 28 days/);
  fillBday(app, 'Aki', 31, 4, null);
  await app.run('addBday()');
  assert.match(app.el('bday-msg').textContent, /April has only 30 days/);
});

test('29 February is allowed when the birth year is unknown or a leap year', async () => {
  const app = loadApp();
  app.run('GUEST=true;UID="guest"');
  fillBday(app, 'Leap', 29, 2, null);
  await app.run('addBday()');
  fillBday(app, 'Leap2', 29, 2, 2000);
  await app.run('addBday()');
  assert.equal(app.run('birthdays.length'), 2);
});

test('birth years outside 1901–this year are rejected', async () => {
  const app = loadApp();
  fillBday(app, 'Old', 1, 1, 1900);
  await app.run('addBday()');
  assert.match(app.el('bday-msg').textContent, /year between 1901 and \d{4}/);
  fillBday(app, 'Future', 1, 1, new Date().getFullYear() + 1);
  await app.run('addBday()');
  assert.match(app.el('bday-msg').textContent, /year between 1901 and \d{4}/);
});

test('preview mode can add, edit and delete birthdays on this device', async () => {
  const app = loadApp();
  app.run('GUEST=true;UID="guest"');
  fillBday(app, 'Mika', 3, 5, 1995);
  await app.run('addBday()');
  assert.equal(app.el('bday-msg').textContent, '');
  assert.equal(app.run('birthdays[0].person_name'), 'Mika');
  const id = app.run('birthdays[0].id');
  app.run(`editBday('${id}')`);
  app.el('bday-name').value = 'Mika S';
  await app.run('addBday()');
  assert.equal(app.run('birthdays[0].person_name'), 'Mika S');
  // survives a reload of this device's copy
  await app.run('loadBirthdays()');
  assert.equal(app.run('birthdays.length'), 1);
  await app.run(`deleteBday('${id}')`);
  await app.run('loadBirthdays()');
  assert.equal(app.run('birthdays.length'), 0);
});

test('a signed-in insert that returns no row shows a message instead of crashing', async () => {
  const app = loadApp();
  app.run('GUEST=false;UID="u1"');
  fillBday(app, 'Ken', 10, 10, 1980);
  await app.run('addBday()');
  assert.doesNotMatch(app.el('bday-msg').textContent, /Cannot read properties/);
  assert.notEqual(app.el('bday-msg').textContent, '');
});

test('signing out resets birthdays to an empty list', async () => {
  const app = loadApp();
  app.run('resetSignedOutState()');
  assert.equal(app.run('Array.isArray(birthdays)'), true);
});

test('online holiday names stay in English', async () => {
  const app = loadApp();
  app.sandbox.fetch = async () => ({ ok: true, json: async () => [{ date: '2026-10-12', localName: 'スポーツの日', name: 'Sports Day' }] });
  await app.run('refreshHolidays()');
  assert.equal(app.run(`getHoliday('2026-10-12')`), 'Sports Day');
});

test('the Sukkiri link is not a localhost URL off localhost', () => {
  const app = loadApp();
  app.sandbox.location = { hostname: 'celeritas7.github.io', href: 'https://celeritas7.github.io/Calender_app/' };
  assert.equal(app.run('skAppUrl()'), '');
  app.sandbox.location = { hostname: 'localhost', href: 'http://localhost:8080/' };
  assert.equal(app.run('skAppUrl()'), 'http://localhost:8091');
  app.store.calapp_sukkiri_url = 'https://example.org/sukkiri/';
  assert.equal(app.run('skAppUrl()'), 'https://example.org/sukkiri/');
});
