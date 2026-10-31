// The queue of stories: those that are ready but published on a later day (they come out in the first build of that day: src/lib/publication.mjs).
//   npm run schedule                the next 8 weeks as a table: date, story (slug, epoch), the languages that are ready; a warning for a story that has no pt or en
//   npm run schedule -- --weeks=12  another span;   --strict  exit code 1 when there is a warning
//   SITE_TODAY=2026-11-01 npm run schedule   look at the queue as it will be on that day
// A language is ready when the story has its title, hook and story text (pt, en) or `ru_ready: true` with its own Russian text (ru).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { buildToday, isLive, isQueued, publishedDay } from '../src/lib/publication.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const argv = process.argv.slice(2);
const weeks = Number(argv.find((a) => a.startsWith('--weeks='))?.split('=')[1] ?? 8);
const strict = argv.includes('--strict');
const today = buildToday();
const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const until = addDays(today, weeks * 7);
const weekday = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });

const dir = join(root, 'src/content/events');
const stories = readdirSync(dir)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(join(dir, f), 'utf8'), { schema: 'core' }));
const filled = (obj, lang) => ['title', 'hook', 'story'].every((k) => typeof obj[k]?.[lang] === 'string' && obj[k][lang].trim().length > 0);
const languages = (s) => ({ pt: filled(s, 'pt'), en: filled(s, 'en'), ru: s.ru_ready === true && filled(s, 'ru') && Boolean(s.slug?.ru) });

const queued = stories.filter((s) => isQueued(s, today)).sort((a, b) => publishedDay(a.published).localeCompare(publishedDay(b.published)) || a.id.localeCompare(b.id));
const inSpan = queued.filter((s) => publishedDay(s.published) <= until);
const later = queued.length - inSpan.length;

const rows = inSpan.map((s) => {
  const l = languages(s);
  return { date: publishedDay(s.published), id: s.id, slug: s.slug?.pt ?? '', epoch: s.epoch, langs: ['pt', 'en', 'ru'].map((x) => (l[x] ? x : '--')).join(' '), l };
});
const warnings = rows.filter((r) => !r.l.pt || !r.l.en).map((r) => `${r.date} ${r.id}: no ${[!r.l.pt && 'pt', !r.l.en && 'en'].filter(Boolean).join(' and ')} text (title, hook and story): the story would come out without it`);

console.log(`Queue of stories (today in Lisbon: ${today}, the next ${weeks} weeks, up to ${until}). They come out in the first build after 05:00 UTC of their day.`);
console.log(`On the site now: ${stories.filter((s) => isLive(s, today)).length} stories.\n`);
if (rows.length === 0) {
  console.log('Nothing is queued for this span.');
} else {
  const head = ['date', 'day', 'story (slug pt)', 'epoch', 'languages'];
  const table = rows.map((r) => [r.date, weekday(r.date), r.slug || r.id, r.epoch, r.langs]);
  const width = head.map((h, i) => Math.max(h.length, ...table.map((r) => r[i].length)));
  const line = (r) => r.map((c, i) => c.padEnd(width[i])).join('  ').trimEnd();
  console.log(line(head));
  console.log(width.map((w) => '-'.repeat(w)).join('  '));
  for (const r of table) console.log(line(r));
  console.log(`\n${rows.length} ${rows.length === 1 ? 'story' : 'stories'} in the queue${later ? `, ${later} more after ${until}` : ''}.`);
}
if (rows.length === 0 && later > 0) console.log(`${later} more queued after ${until}.`);
if (warnings.length) {
  console.log('');
  for (const w of warnings) console.log(`WARNING  ${w}`);
}
process.exit(strict && warnings.length ? 1 : 0);
