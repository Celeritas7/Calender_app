/* Unit tests for the pure helpers in js/app.js and js/sukkiri.js.
 *   npm test                                                 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');

const plain = (v) => JSON.parse(JSON.stringify(v));

test('daysIn handles month lengths and leap years', () => {
  const app = loadApp();
  const daysIn = app.run('daysIn');
  assert.equal(daysIn(2026, 0), 31);
  assert.equal(daysIn(2026, 1), 28);
  assert.equal(daysIn(2024, 1), 29);
  assert.equal(daysIn(2026, 8), 30);
});

test('firstDay is Monday-based (Mon=0 … Sun=6)', () => {
  const firstDay = loadApp().run('firstDay');
  assert.equal(firstDay(2026, 9), 3);  // 1 Oct 2026 is a Thursday
  assert.equal(firstDay(2026, 1), 6);  // 1 Feb 2026 is a Sunday
  assert.equal(firstDay(2026, 5), 0);  // 1 Jun 2026 is a Monday
});

test('calcAge counts a birthday only once it has passed', () => {
  const calcAge = loadApp().run('calcAge');
  const born = new Date('2000-10-20T00:00:00');
  assert.equal(calcAge(born, new Date('2026-10-19T00:00:00')), 25);
  assert.equal(calcAge(born, new Date('2026-10-20T00:00:00')), 26);
});

test('yearKnown treats 1900 as "year not given"', () => {
  const yearKnown = loadApp().run('yearKnown');
  assert.equal(yearKnown({ birth_date: '1900-03-04' }), false);
  assert.equal(yearKnown({ birth_date: '1991-03-04' }), true);
});

test('decodeDiary splits the +/-/~ line prefixes into text and moods', () => {
  const decodeDiary = loadApp().run('decodeDiary');
  const d = decodeDiary('+good day\n-bad bit\n~so-so\nlegacy line');
  assert.equal(d.text, 'good day\nbad bit\nso-so\nlegacy line');
  assert.deepEqual(plain(d.moods).map(m => m.mood), ['good', 'bad', 'neutral', 'neutral']);
  assert.deepEqual(plain(decodeDiary('')), { text: '', moods: [] });
});

test('encodeDiary writes one prefix per non-empty line', () => {
  const app = loadApp();
  app.el('inp-diary').value = 'first\n\nsecond\nthird';
  app.run(`diaryLineMoods=[{mood:'good'},{mood:'neutral'},{mood:'bad'},{mood:'neutral'}]`);
  assert.equal(app.run('encodeDiary()'), '+first\n-second\n~third');
});

test('encodeDiary(decodeDiary(x)) round-trips', () => {
  const app = loadApp();
  const src = '-bad line\n+good line\n~neutral line';
  const d = app.run('decodeDiary')(src);
  app.el('inp-diary').value = d.text;
  app.sandbox.__moods = d.moods;
  app.run('diaryLineMoods=__moods');
  assert.equal(app.run('encodeDiary()'), src);
});

test('diaryOverallMood summarises the line moods', () => {
  const mood = loadApp().run('diaryOverallMood');
  assert.equal(mood('+a\n+b'), 'good');
  assert.equal(mood('-a\n~b'), 'bad');
  assert.equal(mood('+a\n-b'), 'mixed');
  assert.equal(mood('~a'), null);
  assert.equal(mood(''), null);
});

test('skGarbageOn applies weekday and week-of-month rules (default rules)', () => {
  const on = loadApp().run('(k)=>JSON.stringify(skGarbageOn(k).map(g=>g.label))');
  assert.deepEqual(JSON.parse(on('2026-10-05')), ['Burnable']);             // Monday
  assert.deepEqual(JSON.parse(on('2026-10-06')), ['Plastic']);              // Tuesday
  assert.deepEqual(JSON.parse(on('2026-10-02')), ['Non-burnable']);         // 1st Friday
  assert.deepEqual(JSON.parse(on('2026-10-09')), ['Paper']);                // 2nd Friday
  assert.deepEqual(JSON.parse(on('2026-10-04')), []);                       // Sunday
});

function withCycle(app) {
  app.run(`sk.cycles=[{id:'t',name:'Test',every:7,anchor:'2026-10-04',color:'#000',kind:'home'}];
           sk.overrides={};sk.done={};sk.away=[];sk.block={urg:true,any:false,away:true,hol:false}`);
  return (from, to) => plain(app.run('skOccurrences')(from, to)).filter(o => o.due >= from);
}

test('skOccurrences steps a cycle every N days from its anchor', () => {
  const occ = withCycle(loadApp())('2026-10-01', '2026-10-31');
  assert.deepEqual(occ.map(o => o.due), ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
  assert.ok(occ.every(o => o.mode === 'due' && o.at === o.due));
});

test('skOccurrences honours manual overrides', () => {
  const app = loadApp();
  const occ = withCycle(app);
  app.run(`sk.overrides={'t|2026-10-11':'before','t|2026-10-18':'after','t|2026-10-25':'skip'}`);
  const byDue = Object.fromEntries(occ('2026-10-01', '2026-10-31').map(o => [o.due, o]));
  assert.equal(byDue['2026-10-11'].at, '2026-10-04');
  assert.equal(byDue['2026-10-18'].at, '2026-10-25');
  assert.equal(byDue['2026-10-25'].mode, 'skip');
});

test('skOccurrences moves a phase one week earlier on an away day', () => {
  const app = loadApp();
  const occ = withCycle(app);
  app.run(`sk.away=['2026-10-18']`);
  const o = occ('2026-10-01', '2026-10-31').find(x => x.due === '2026-10-18');
  assert.equal(o.mode, 'auto');
  assert.equal(o.at, '2026-10-11');
  assert.equal(o.reason, 'away');
});

test('skWkShift pushes weekdays forward to Saturday and leaves weekends alone', () => {
  const shift = loadApp().run('skWkShift');
  assert.equal(shift('2026-10-14'), '2026-10-17');  // Wed → Sat
  assert.equal(shift('2026-10-17'), '2026-10-17');  // Sat stays
  assert.equal(shift('2026-10-18'), '2026-10-18');  // Sun stays
});
