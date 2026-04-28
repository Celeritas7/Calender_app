const fs = require('fs');
const path = require('path');
const SRC = '.claude/decoded/_template.json';
// _template.json is JSON-stringified HTML. Read & write to .html
const raw = fs.readFileSync(SRC, 'utf8');
const html = JSON.parse(raw);
fs.writeFileSync('.claude/decoded/_template.html', html);
console.log('Wrote .claude/decoded/_template.html len=', html.length);
