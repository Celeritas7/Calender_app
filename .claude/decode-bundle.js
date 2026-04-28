// Decode the bundler manifest+template into a directory of files
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SRC = process.argv[2] || 'themes-audit-bundle.html';
const OUT = process.argv[3] || '.claude/decoded';

const html = fs.readFileSync(SRC, 'utf8');

function extract(html, type) {
  const re = new RegExp(`<script type="__bundler/${type}">([\\s\\S]*?)<\\/script>`);
  const m = html.match(re);
  if (!m) throw new Error('cant find ' + type);
  return m[1].trim();
}

const manifestStr = extract(html, 'manifest');
const templateStr = extract(html, 'template');

const manifest = JSON.parse(manifestStr);
const template = JSON.parse(templateStr);

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

console.log('Template (the entry HTML/JS) length:', templateStr.length);
console.log('Manifest entries:', Object.keys(manifest).length);

// Write template
fs.writeFileSync(path.join(OUT, '_template.json'), JSON.stringify(template, null, 2));

// Build a uuid -> filename map by reading metadata from template if present
// Each manifest entry has data/mime/compressed/path possibly
const summary = [];
for (const uuid of Object.keys(manifest)) {
  const entry = manifest[uuid];
  const data = Buffer.from(entry.data, 'base64');
  let bytes = data;
  if (entry.compressed) {
    try { bytes = zlib.gunzipSync(data); }
    catch (e) {
      try { bytes = zlib.inflateSync(data); }
      catch (e2) {
        try { bytes = zlib.brotliDecompressSync(data); }
        catch (e3) { console.warn('cant decompress', uuid, e.message); }
      }
    }
  }
  const ext = (entry.mime || '').includes('html') ? 'html'
    : (entry.mime || '').includes('css') ? 'css'
    : (entry.mime || '').includes('javascript') ? 'js'
    : (entry.mime || '').includes('json') ? 'json'
    : (entry.mime || '').includes('svg') ? 'svg'
    : (entry.mime || '').includes('png') ? 'png'
    : 'bin';
  const name = (entry.path || uuid).replace(/[^a-zA-Z0-9._-]/g, '_');
  const fname = `${uuid}__${name}.${ext}`;
  fs.writeFileSync(path.join(OUT, fname), bytes);
  summary.push({ uuid, mime: entry.mime, path: entry.path, size: bytes.length, file: fname });
}

fs.writeFileSync(path.join(OUT, '_summary.json'), JSON.stringify(summary, null, 2));
console.log('Wrote', summary.length, 'asset(s) to', OUT);
console.log('Top types:');
const byType = {};
summary.forEach(s => { byType[s.mime] = (byType[s.mime]||0)+1; });
console.log(byType);
