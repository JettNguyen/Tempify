const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'src', 'assets');
const hot100Path = path.join(assetsDir, 'hot-100-index.json');
const bill200Path = path.join(assetsDir, 'billboard-200-index.json');
const outDir = path.join(root, 'outputs');

function loadJson(p) {
  if (!fs.existsSync(p)) {
    console.error('Missing file:', p);
    process.exit(1);
  }
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.entries)) return data.entries;
  return Object.values(data);
}

function normalizeText(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // remove parenthetical text
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTitleArtist(entry) {
  const titleKeys = ['title', 'song', 'name', 'track'];
  const artistKeys = ['artist', 'artists', 'artistName', 'primaryArtist'];

  let title = titleKeys.map(k => entry[k]).find(Boolean);
  if (!title && typeof entry === 'string') title = entry;

  let artist = artistKeys.map(k => entry[k]).find(Boolean);
  if (Array.isArray(artist)) artist = artist.join(', ');
  if (!artist && entry && entry.performer) artist = entry.performer;

  return {
    title: title || '',
    artist: artist || '',
    raw: entry,
  };
}

function canonicalKey(entry) {
  const { title, artist } = getTitleArtist(entry);
  return `${normalizeText(title)} --- ${normalizeText(artist)}`;
}

function ensureOutDir() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
}

function main() {
  const hot = loadJson(hot100Path);
  const bill = loadJson(bill200Path);

  const hotArr = toArray(hot);
  const billArr = toArray(bill);

  const hotSet = new Set(hotArr.map(canonicalKey));

  const only200 = billArr.filter(item => !hotSet.has(canonicalKey(item)));

  ensureOutDir();

  const jsonOut = path.join(outDir, 'only-in-200.json');
  fs.writeFileSync(jsonOut, JSON.stringify(only200, null, 2), 'utf8');

  const csvOut = path.join(outDir, 'only-in-200.csv');
  const header = ['title', 'artist'];
  const rows = [header.join(',')];
  for (const it of only200) {
    const { title, artist } = getTitleArtist(it);
    // naive CSV escaping
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    rows.push([esc(title), esc(artist)].join(','));
  }
  fs.writeFileSync(csvOut, rows.join('\n'), 'utf8');

  console.log('Found', only200.length, 'songs in the Top 200 that never entered the Top 100');
  console.log('JSON output:', jsonOut);
  console.log('CSV output:', csvOut);
}

if (require.main === module) main();

module.exports = { main };
