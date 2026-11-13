// The search title and description of the stories, read from the YAML files (for scripts/seo-table.ts and scripts/schedule.mjs).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { localize } from '../../src/lib/localize';
import { storySeoDescription, storySeoTitle } from '../../src/lib/seo';
import type { Lang } from '../../src/i18n/routes';

const root = fileURLToPath(new URL('../..', import.meta.url));
export const SEO_LANGS: readonly Lang[] = ['pt', 'en', 'ru'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readYaml = (path: string): any => parse(readFileSync(path, 'utf8'), { schema: 'core' });

/** Every story file (ready or not) with its title and description in the three languages (ru falls back to en when the story is not ready in Russian, as on the site). */
export function seoLines() {
  const epochs = readYaml(join(root, 'src/content/epochs.yaml')) as { id: string; name: Record<Lang, string> }[];
  const dir = join(root, 'src/content/events');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => {
      const raw = readYaml(join(dir, f));
      const event = localize(raw, raw.ru_ready === true);
      const epochName = localize(epochs.find((e) => e.id === raw.epoch)?.name ?? { pt: '', en: '' }, raw.ru_ready === true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lines = Object.fromEntries(SEO_LANGS.map((lang) => [lang, { title: storySeoTitle(event as any, lang), description: storySeoDescription(event as any, lang, epochName[lang]), own: Boolean(event.seo?.title?.[lang] || event.seo?.description?.[lang]) }]));
      return { id: raw.id as string, slug: (raw.slug?.pt ?? raw.id) as string, raw, event, lines: lines as Record<Lang, { title: string; description: string; own: boolean }> };
    });
}
