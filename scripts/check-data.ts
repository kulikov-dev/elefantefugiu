// Validates src/content/*.yaml beyond what Zod can express and prints a summary.
// Usage: npm run check:data   (ALLOW_PLACEHOLDER=false fails on placeholder entries)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseDocument } from 'yaml';
import type { ZodType } from 'astro/zod';
import { MIN_CARDS_PER_THREAD, countCardsByThread } from '../src/lib/threads';
import { epochSchema, eventSchema, featuredSchema, threadSchema } from '../src/data/schemas';

const root = new URL('..', import.meta.url).pathname;
const content = join(root, 'src/content');

type Level = 'error' | 'warn';
interface Problem {
  level: Level;
  file: string;
  field?: string;
  lang?: string;
  message: string;
}
const problems: Problem[] = [];
const report = (level: Level, file: string, message: string, field?: string, lang?: string) =>
  problems.push({ level, file, field, lang, message });

const rel = (path: string) => relative(root, path);
const isLang = (v: unknown): v is 'pt' | 'en' => v === 'pt' || v === 'en';

/** Same parser options as Astro's YAML loader, so results match the build. */
function readYaml(path: string): unknown {
  const doc = parseDocument(readFileSync(path, 'utf8'), { customTags: ['timestamp'], merge: true, schema: 'core' });
  if (doc.errors.length > 0) {
    report('error', rel(path), `YAML syntax error: ${doc.errors[0]!.message.split('\n')[0]}`);
    return undefined;
  }
  return doc.toJS();
}

function validate<T>(schema: ZodType<T>, data: unknown, file: string): T | undefined {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const path = issue.path as (string | number)[];
    const lang = path.find(isLang);
    const field = path
      .filter((p) => p !== lang)
      .map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? p : `.${p}`))
      .join('');
    report('error', file, issue.message, field || undefined, lang);
  }
  return undefined;
}

function loadList<T>(name: string, schema: ZodType<T>): { item: T; file: string }[] {
  const path = join(content, `${name}.yaml`);
  const file = rel(path);
  if (!existsSync(path)) {
    report('error', file, 'file is missing');
    return [];
  }
  const data = readYaml(path);
  if (data === undefined) return [];
  if (!Array.isArray(data)) {
    report('error', file, 'expected a list of entries');
    return [];
  }
  const out: { item: T; file: string }[] = [];
  data.forEach((entry, i) => {
    const parsed = validate(schema, entry, `${file} (entry ${i + 1})`);
    if (parsed) out.push({ item: parsed, file: `${file} (entry ${i + 1})` });
  });
  return out;
}

// ---------- load ----------
const epochs = loadList('epochs', epochSchema);
const threads = loadList('threads', threadSchema);
const featured = loadList('featured', featuredSchema);

type Event = ReturnType<typeof eventSchema.parse>;
const events: { item: Event; file: string; stem: string }[] = [];
const eventsDir = join(content, 'events');
for (const name of existsSync(eventsDir) ? readdirSync(eventsDir).sort() : []) {
  if (!name.endsWith('.yaml')) continue;
  const path = join(eventsDir, name);
  const data = readYaml(path);
  if (data === undefined) continue;
  const parsed = validate(eventSchema, data, rel(path));
  if (parsed) events.push({ item: parsed, file: rel(path), stem: name.replace(/\.yaml$/, '') });
}

// ---------- rules ----------
for (const { item, file } of epochs) {
  if (item.fallback_image && !existsSync(join(root, 'public', item.fallback_image))) {
    report('error', file, `file "public/${item.fallback_image}" does not exist`, 'fallback_image');
  }
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const isTodo = (s: string) => s.trim() === '' || /^TODO\b/i.test(s.trim());
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTP = /^https?:\/\/\S+$/;

// Portugal mainland and the nearest islands (Madeira, Azores).
const AREAS = [
  { name: 'mainland', lat: [36.8, 42.2], lon: [-9.6, -6.1] },
  { name: 'Madeira', lat: [32.3, 33.2], lon: [-17.4, -16.2] },
  { name: 'Azores', lat: [36.8, 39.9], lon: [-31.4, -24.9] },
] as const;
const inPortugal = (lat: number, lon: number) =>
  AREAS.some((a) => lat >= a.lat[0] && lat <= a.lat[1] && lon >= a.lon[0] && lon <= a.lon[1]);

function dupes(label: string, entries: { id: string; file: string }[]) {
  const seen = new Map<string, string>();
  for (const e of entries) {
    const first = seen.get(e.id);
    if (first) report('error', e.file, `duplicate ${label} "${e.id}" (also in ${first})`, 'id');
    else seen.set(e.id, e.file);
  }
}
dupes('epoch id', epochs.map((e) => ({ id: e.item.id, file: e.file })));
dupes('thread id', threads.map((e) => ({ id: e.item.id, file: e.file })));
dupes('event id', events.map((e) => ({ id: e.item.id, file: e.file })));

const epochIds = new Set(epochs.map((e) => e.item.id));
const threadIds = new Set(threads.map((e) => e.item.id));
const eventIds = new Set(events.map((e) => e.item.id));
const epochById = new Map(epochs.map((e) => [e.item.id, e.item]));
const slugOwner: Record<'pt' | 'en', Map<string, string>> = { pt: new Map(), en: new Map() };

for (const { item: ev, file, stem } of events) {
  const ready = ev.status === 'ready';
  const lenLevel: Level = ev.placeholder ? 'warn' : 'error';

  if (ev.id !== stem) report('error', file, `id "${ev.id}" must match the file name "${stem}"`, 'id');
  if (!epochIds.has(ev.epoch)) report('error', file, `unknown epoch "${ev.epoch}" (not in epochs.yaml)`, 'epoch');

  // slugs
  for (const lang of ['pt', 'en'] as const) {
    const value = ev.slug[lang];
    if (!SLUG.test(value)) {
      report('error', file, `slug "${value}" must use lowercase Latin letters, digits and hyphens`, 'slug', lang);
    }
    const owner = slugOwner[lang].get(value);
    if (owner) report('error', file, `slug "${value}" is already used by ${owner}`, 'slug', lang);
    else slugOwner[lang].set(value, file);
  }

  // level and importance
  if (ev.level === 'frame' && ev.importance !== 3) {
    report('error', file, `frame events must have importance 3, got ${ev.importance}`, 'importance');
  }
  if (ev.level === 'story' && ev.importance === 3) {
    report('error', file, 'importance 3 is reserved for frame events', 'importance');
  }

  // threads: first is the primary one, at most two, only from the catalogue
  ev.threads.forEach((t, i) => {
    if (!threadIds.has(t)) report('error', file, `unknown thread "${t}" (not in threads.yaml)`, `threads[${i}]`);
  });
  if (new Set(ev.threads).size !== ev.threads.length) report('error', file, 'the same thread is listed twice', 'threads');

  // text length
  const limits = { hook: [0, 12], story: [40, 70], more: [0, 150] } as const;
  for (const field of ['hook', 'story', 'more'] as const) {
    for (const lang of ['pt', 'en'] as const) {
      const value = ev[field][lang];
      if (isTodo(value)) {
        if (ready) report('error', file, 'text is empty or TODO but status is ready', field, lang);
        continue;
      }
      const [min, max] = limits[field];
      const n = words(value);
      if (n > max || n < min) {
        const allowed = min > 0 ? `${min}-${max}` : `up to ${max}`;
        report(lenLevel, file, `${n} words, allowed ${allowed}`, field, lang);
      }
    }
  }

  // coordinates
  for (const [field, p] of [['place', ev.place], ['bridge', ev.bridge]] as const) {
    if (!inPortugal(p.lat, p.lon)) {
      report('error', file, `lat/lon (${p.lat}, ${p.lon}) is outside Portugal and nearby islands`, field);
    }
  }

  // image
  if (ev.image) {
    for (const lang of ['pt', 'en'] as const) {
      if (ev.image.alt[lang].trim() === '') report('error', file, 'alt text is empty', 'image.alt', lang);
    }
    if (ev.image.caption) {
      for (const lang of ['pt', 'en'] as const) {
        if (ev.image.caption[lang].trim() === '') report('error', file, 'caption is empty (give both languages or remove the field)', 'image.caption', lang);
      }
    }
    if (ev.image.license.trim() === '') report('error', file, 'license is empty', 'image.license');
    if (!existsSync(join(root, 'public', ev.image.src))) {
      report('error', file, `file "public/${ev.image.src}" does not exist`, 'image.src');
    }
  }

  // related
  for (const id of ev.related ?? []) {
    if (id === ev.id) report('error', file, 'event lists itself as related', 'related');
    else if (!eventIds.has(id)) report('error', file, `unknown event id "${id}"`, 'related');
  }

  // year inside the epoch range (warning only)
  const epoch = epochById.get(ev.epoch);
  const [from, to] = typeof ev.year === 'number' ? [ev.year, ev.year] : [ev.year.from, ev.year.to];
  if (epoch && (from < epoch.years.from || to > epoch.years.to)) {
    report('warn', file, `year ${from === to ? from : `${from}-${to}`} is outside the epoch range ${epoch.years.from}-${epoch.years.to}`, 'year');
  }

  // fields required for ready
  if (ready) {
    if (ev.reviewed_by === undefined || ev.reviewed_by.trim() === '') report('error', file, 'required when status is ready', 'reviewed_by');
    if (ev.reviewed_on === undefined) report('error', file, 'required when status is ready', 'reviewed_on');
    for (const key of ['name', 'address', 'url'] as const) {
      if (isTodo(ev.bridge[key])) report('error', file, 'is empty or TODO but status is ready', `bridge.${key}`);
    }
    if (!HTTP.test(ev.bridge.url)) report('error', file, `"${ev.bridge.url}" is not an http(s) address`, 'bridge.url');
    const minSources = ev.level === 'frame' ? 2 : 1;
    if (ev.sources.length < minSources) {
      report('error', file, `${ev.sources.length} source(s), ready ${ev.level} events need at least ${minSources}`, 'sources');
    }
  }
  ev.sources.forEach((s, i) => {
    if (ready && !HTTP.test(s.url)) report('error', file, `"${s.url}" is not an http(s) address`, `sources[${i}].url`);
  });
}

// featured
featured.forEach(({ item, file }) => {
  const ev = events.find((e) => e.item.id === item.id)?.item;
  if (!ev) report('error', file, `unknown event id "${item.id}"`, 'id');
  else if (ev.status !== 'ready') report('error', file, `event "${item.id}" is not ready`, 'id');
});
dupes('featured id', featured.map((f) => ({ id: f.item.id, file: f.file })));
if (featured.length !== 3) report('error', 'src/content/featured.yaml', `${featured.length} entries, the home page needs exactly 3 (spec 5.1)`);

// ALLOW_PLACEHOLDER gate
const allowRaw = (process.env.ALLOW_PLACEHOLDER ?? 'true').trim().toLowerCase();
if (allowRaw !== 'true' && allowRaw !== 'false') {
  report('error', 'environment', `ALLOW_PLACEHOLDER must be "true" or "false", got "${process.env.ALLOW_PLACEHOLDER}"`);
}
const placeholders = [
  ...events.filter((e) => e.item.placeholder).map((e) => e.file),
  ...epochs.filter((e) => e.item.placeholder).map((e) => e.file),
  ...threads.filter((e) => e.item.placeholder).map((e) => e.file),
];
if (allowRaw === 'false' && placeholders.length > 0) {
  const shown = placeholders.slice(0, 5).join(', ');
  report('error', 'environment', `ALLOW_PLACEHOLDER=false but ${placeholders.length} entries have placeholder: true (${shown}${placeholders.length > 5 ? ', ...' : ''})`);
}

// threads with few cards are hidden from filters and menus (decision after stage 2)
const cardCounts = countCardsByThread(events.map((e) => e.item));
for (const t of threads) {
  const n = cardCounts.get(t.item.id) ?? 0;
  if (n < MIN_CARDS_PER_THREAD) {
    report('warn', t.file, `thread "${t.item.id}" has ${n} cards, it is hidden from filters and menus (needs ${MIN_CARDS_PER_THREAD})`);
  }
}

// ---------- output ----------
const errors = problems.filter((p) => p.level === 'error');
const warnings = problems.filter((p) => p.level === 'warn');
for (const p of [...errors, ...warnings]) {
  const where = [p.field && `field ${p.field}`, p.lang && `language ${p.lang}`].filter(Boolean).join(', ');
  console.log(`${p.level === 'error' ? 'ERROR' : 'WARN '} ${p.file}${where ? ` [${where}]` : ''}: ${p.message}`);
}

const count = <K extends string>(keys: K[]) => {
  const m = new Map<K, number>();
  keys.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1));
  return m;
};
const evs = events.map((e) => e.item);
const LISBON = { lat: 38.7223, lon: -9.1393 };
const km = (lat: number, lon: number) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat - LISBON.lat) / 2) ** 2 + Math.cos(r(LISBON.lat)) * Math.cos(r(lat)) * Math.sin(r(lon - LISBON.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
};
const near = evs.filter((e) => km(e.place.lat, e.place.lon) <= 10);
const far = evs.filter((e) => km(e.place.lat, e.place.lon) > 10);

console.log('\nData summary');
console.log(`  epochs: ${epochs.length}, threads: ${threads.length}, featured: ${featured.map((f) => f.item.id).join(', ') || '-'}`);
console.log(`  events: ${evs.length} (${evs.filter((e) => e.level === 'frame').length} frame, ${evs.filter((e) => e.level === 'story').length} story)`);
console.log('  by epoch:');
for (const ep of epochs.map((e) => e.item).sort((a, b) => a.order - b.order)) {
  const own = evs.filter((e) => e.epoch === ep.id);
  console.log(`    ${ep.id}: ${own.length} (${own.filter((e) => e.level === 'frame').length} frame, ${own.filter((e) => e.level === 'story').length} story)`);
}
console.log('  by thread (primary / all cards):');
for (const t of threads.map((e) => e.item)) {
  console.log(`    ${t.id}: ${evs.filter((e) => e.threads[0] === t.id).length} / ${evs.filter((e) => e.threads.includes(t.id)).length}`);
}
const ages = count(evs.map((e) => e.min_age));
console.log(`  by age: all ${ages.get('all') ?? 0}, 12+ ${ages.get('12') ?? 0}, 16+ ${ages.get('16') ?? 0}; sensitive: ${evs.filter((e) => e.sensitive).length}`);
const labels = count(evs.map((e) => e.label));
console.log(`  by label: documented ${labels.get('documented') ?? 0}, legend ${labels.get('legend') ?? 0}, debated ${labels.get('debated') ?? 0}`);
const inter = count(evs.flatMap((e) => (e.interactive ? [e.interactive.type] : [])));
console.log(`  images: ${evs.filter((e) => e.image).length} with, ${evs.filter((e) => !e.image).length} without; interactives: army_dots ${inter.get('army_dots') ?? 0}, ship_scale ${inter.get('ship_scale') ?? 0}`);
console.log(`  within 10 km of Lisbon: ${near.length}; elsewhere: ${far.length} (${[...new Set(far.map((e) => e.place.name))].join(', ')})`);
console.log(`  placeholder entries: ${placeholders.length} (ALLOW_PLACEHOLDER=${allowRaw})`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length > 0) process.exit(1);
