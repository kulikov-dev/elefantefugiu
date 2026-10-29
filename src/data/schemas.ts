// Zod schemas for the content collections (docs/spec.md section 7).
// Shared by src/content.config.ts (Astro) and scripts/check-data.ts (readable checks).
import { z } from 'astro/zod';
import { missingRu } from '../lib/localize';

/** Text in the site languages. pt and en are always there; ru is optional (an event needs it only when ru_ready is true). */
export const text = z.strictObject({ pt: z.string(), en: z.string(), ru: z.string().optional() });

const slug = z.string();
/** Address part per language; ru is optional (an event not ready in Russian uses its English address under /ru/). */
const slugs = z.strictObject({ pt: slug, en: slug, ru: slug.optional() });
const yearRange = z.strictObject({ from: z.number().int(), to: z.number().int() });

// YAML reads an unquoted 12 as a number, so accept 12 and "12" and always output a string:
// "all", "12" or "16" (decision after stage 2).
export const minAge = z.preprocess((v) => (typeof v === 'number' ? String(v) : v), z.enum(['all', '12', '16']));

const source = z.strictObject({
  /** The title as the author gave it (in the language of the original). No Cyrillic unless `lang` is 'ru' (a source written in Russian). */
  title: z.string(),
  /** A remark on the source (what it is used for, "official website", "slide"), shown small after the link. Any language may be left out:
   *  where it is missing nothing is shown, and no other language takes its place (localize() leaves it alone). */
  note: z.strictObject({ pt: z.string().optional(), en: z.string().optional(), ru: z.string().optional() }).optional(),
  /** The language of the source when it is Russian: pt and en pages mark it "(in Russian)" and may show its Cyrillic title. */
  lang: z.literal('ru').optional(),
  url: z.string(),
  type: z.string(),
  accessed: z.coerce.date(),
});

/** A picture: the file is in src/assets/stories/ (Astro makes the sizes), the rest is what the page shows under it. */
export const picture = z.strictObject({
  /** File name inside src/assets/stories/, for example cantino-1502.webp. */
  file: z.string(),
  /** What the picture shows, one sentence, for every language the card is written in. */
  alt: text,
  /** The visible caption: who, what, when, where it is kept. For an AI picture it says so. */
  caption: text,
  /** A name (the same in every language) or a text per language ("Unknown author"). */
  author: z.union([z.string(), text]),
  /** "Public domain", "CC0", "CC BY 4.0", "CC BY-SA 4.0", "AI-generated". */
  license: z.string(),
  /** The licence text; required for CC BY and CC BY-SA (check-data). */
  license_url: z.string().optional(),
  /** The page of the picture (Commons). Not needed for an AI picture and never shown for one. */
  source_url: z.string().optional(),
  /** Made by an AI: the caption already says so, no extra badge; the page shows the caption only. */
  ai: z.boolean().default(false),
  /** object-position of the crop on cards ("20% 55%"); without it the centre. */
  focus: z
    .string()
    .regex(/^\d{1,3}% \d{1,3}%$/, 'focus is "x% y%", for example "50% 30%"')
    .optional(),
});

/** Keys of the interactive colour tokens: --viz-tone-<key> in src/styles/tokens.css. */
export const vizTones = ['blue', 'red', 'green', 'ochre', 'grey'] as const;
const tone = z.enum(vizTones);

/** "1 against 5": groups of dots in one scale; one dot is unit_per_dot people, the estimate is a range, not one number. */
export const armyDotsData = z.strictObject({
  groups: z
    .array(
      z.strictObject({
        id: z.string(),
        label: text,
        /** Low and high estimates (a range, never one number). */
        min: z.number().nonnegative(),
        max: z.number().nonnegative(),
        /** People per dot; the same for every group (one scale). */
        unit_per_dot: z.number().positive(),
        tone,
        note: text,
      }),
    )
    .min(2),
  caption: text,
  /** The "according to historians' estimates" line shown under the dots. */
  estimate_note: text,
  /** True while the numbers are invented test numbers; shown on the card. */
  placeholder: z.boolean().optional(),
});

/** "Size of the nau": silhouettes in one scale, sizes in metres. */
export const shipScaleData = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.string(),
        label: text,
        length_m: z.number().positive(),
        /** Height (keel to top of the tallest mast) in metres; optional. */
        height_m: z.number().positive().optional(),
        tone,
      }),
    )
    .min(2),
  caption: text,
  placeholder: z.boolean().optional(),
});

const interactive = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('army_dots'), data: armyDotsData }),
  z.strictObject({ type: z.literal('ship_scale'), data: shipScaleData }),
]);

export type ArmyDotsData = z.infer<typeof armyDotsData>;
export type ShipScaleData = z.infer<typeof shipScaleData>;

/** A calendar date as YYYY-MM-DD. YAML turns an unquoted 2026-10-21 into a date, so that is accepted and written back as the same text. */
const isoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'a date is YYYY-MM-DD'),
);

/** "Read by a language editor": the day and the hash of the text of one language at that time (scripts/lang-mark.ts writes it, npm run lang:pending reads it). */
const langMark = z.strictObject({ date: isoDate, hash: z.string() });

export const eventSchema = z
  .strictObject({
  id: z.string(),
  slug: slugs,
  // Not in the spec table, but the card needs a title (spec 5.3, block 2).
  title: text,
  epoch: z.string(),
  level: z.enum(['frame', 'story']),
  year: z.union([z.number().int(), yearRange]),
  year_label: text.optional(),
  /** Where the event happened, as text on the card; any coordinates in the world (the map does not use them). */
  place: z.strictObject({
    /** The full name of the place in each language, shown in the header of the story ("Lisboa, Paço da Ribeira (hoje Praça do Comércio)"). */
    name: text,
    /** A short name of the place (a city or a region) in each language, for cards and lists: "1515 · Lisbon". Optional: without it the part of `name` before the first comma or bracket is used. */
    short: text.optional(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  /** "Bridge to today": a place in Portugal or the islands that can be visited now; the map marks THIS point. */
  bridge: z.strictObject({
    /** The name of the place as it is written there (Portuguese): what a visitor looks for on a sign. */
    name: z.string(),
    /** The name in each language of the site, shown first (bold); `name` then goes beneath it. Optional: without it `name` is the title. */
    title: text.optional(),
    address: z.string(),
    lat: z.number(),
    lon: z.number(),
    /** The link of the place on Google Maps (the full address, without tracking parameters); "How to get there" opens it. Without it, a directions link to lat/lon. */
    maps_url: z
      .string()
      .url()
      .refine((u) => u.startsWith('https://www.google.com/maps/') && !/[?&](g_ep|skid|entry|ucbcb)=/.test(u), 'a clean https://www.google.com/maps/ address (no g_ep, skid, entry, ucbcb)')
      .optional(),
    url: z.string(),
    /** One sentence, up to 20 words, both languages. */
    note: text,
  }),
  threads: z.array(z.string()).min(1).max(2),
  importance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  label: z.enum(['documented', 'legend', 'debated']),
  min_age: minAge,
  sensitive: z.boolean(),
  hook: text,
  story: text,
  more: text,
  sources: z.array(source),
  image: picture.optional(),
  /** A second picture (a document, a map, a portrait) shown inside "More", whole, never cropped. */
  detail_image: picture.optional(),
  related: z.array(z.string()).optional(),
  interactive: interactive.optional(),
  /** Optional and not shown anywhere: the project has one editor and no separate reviewer. */
  reviewed_by: z.string().optional(),
  reviewed_on: z.coerce.date().optional(),
  status: z.enum(['draft', 'ready']),
  /** The day the story was first published (YYYY-MM-DD): the schema.org datePublished of the page (src/lib/schema.ts). Required. */
  published: isoDate,
  /** Marks of the language review per language (docs/language-review/); written by scripts/lang-mark.ts, never by hand. */
  lang_review: z.strictObject({ pt: langMark.optional(), en: langMark.optional(), ru: langMark.optional() }).optional(),
  /** The day the story was last changed in substance (YYYY-MM-DD): dateModified; without it dateModified is `published`. */
  updated: isoDate.optional(),
  placeholder: z.boolean().default(false),
  /** The Russian texts are written (and, for a real card, read by a native speaker). While false, /ru/ shows the English text with a banner. */
  ru_ready: z.boolean().default(false),
  })
  .superRefine((event, ctx) => {
    // Russian is required only for an event that says it is ready for it: then every text object needs a ru text.
    if (!event.ru_ready) return;
    for (const path of missingRu(event)) {
      ctx.addIssue({ code: 'custom', path: [...path.split(/[.\[\]]+/).filter(Boolean).map((p) => (/^\d+$/.test(p) ? Number(p) : p)), 'ru'], message: 'ru text is required when ru_ready is true' });
    }
  });

const epochStyle = z.strictObject({
  bg: z.string(),
  accent: z.string(),
  heading_font: z.string(),
  frame: z.string(),
});

/** The fields of an epoch that can still be provisional. Written per field (placeholder: [fallback_image]) so it is clear what is temporary. */
/**
 * One card of "Then and now" on an epoch page: a figure of the epoch beside the same thing today.
 * `then_big` and `now_big` are the short big words (numbers with their unit, written the way each language writes them), `text` is one
 * sentence in the voice of the site. For a road (or any time that can be compared) give `then_hours` and `now_hours` and put `{n}` in the
 * text: the page puts there how many times the "now" fits into the "then" (see src/lib/then-now.ts).
 * kind: known (a recorded fact), estimate (a historians' reconstruction), calc (our own calculation from distance and speed).
 */
export const thenNowCard = z
  .strictObject({
    id: z.string(),
    then_big: text,
    now_big: text,
    text,
    kind: z.enum(['known', 'estimate', 'calc']),
    /** The id of a story of the site that the card leads to. The link shows only once that story is published. */
    story: z.string().optional(),
    then_hours: z.number().positive().optional(),
    now_hours: z.number().positive().optional(),
    /** At least one source for every card. */
    sources: z.array(source).min(1),
  })
  .superRefine((card, ctx) => {
    const hasN = [card.text.pt, card.text.en, card.text.ru ?? ''].some((t) => t.includes('{n}'));
    const everyN = [card.text.pt, card.text.en].every((t) => t.includes('{n}')) && (card.text.ru === undefined || card.text.ru.includes('{n}'));
    if (hasN && !everyN) ctx.addIssue({ code: 'custom', path: ['text'], message: '{n} must be in the text of every language, or in none' });
    if ((card.then_hours === undefined) !== (card.now_hours === undefined)) ctx.addIssue({ code: 'custom', path: ['then_hours'], message: 'then_hours and now_hours go together' });
    if (hasN && card.then_hours === undefined) ctx.addIssue({ code: 'custom', path: ['then_hours'], message: 'the text has {n}: then_hours and now_hours are needed' });
    if (!hasN && card.then_hours !== undefined) ctx.addIssue({ code: 'custom', path: ['text'], message: 'then_hours is given but the text has no {n}' });
  });

export const EPOCH_PLACEHOLDER_FIELDS = ['name', 'theme', 'style', 'intro', 'fallback_image'] as const;

export const epochSchema = z
  .strictObject({
    id: z.string(),
    /** Address part per language: /pt/epoca/{slug}, /en/era/{slug}. */
    slug: slugs,
    order: z.number().int(),
    name: text,
    /** Numeric range. Required for MVP epochs (the page and the card year check use it); optional otherwise. */
    years: yearRange.optional(),
    /** Display text for the years, for example "1580\u20131750". Required when mvp is false (tiles and "Coming soon" neighbours). */
    years_label: text.optional(),
    /** Theme phrase. Required for MVP epochs; epochs without a page do not need one. */
    theme: text.optional(),
    /** One or two sentences (up to about 155 characters) for the meta description of the epoch page and its link preview; without it the theme phrase is used. */
    description: text.optional(),
    /** Epoch look (stage 6). Required for MVP epochs. */
    style: epochStyle.optional(),
    mvp: z.boolean(),
    /**
     * A short introduction for readers who do not know the epoch (2 or 3 sentences), per language. Every language is optional and a
     * missing one is never replaced by another: the page shows the block only in a language that has the text.
     */
    intro: z.strictObject({ pt: z.string().optional(), en: z.string().optional(), ru: z.string().optional() }).optional(),
    /**
     * The picture of cards of this epoch that have no image of their own (cards, "Next", previews). A path inside public/ (a string)
     * is a provisional picture that only serves the preview (Estado Novo); a real picture is an object.
     */
    fallback_image: z.union([picture, z.string()]).optional(),
    /** "Then and now": exactly three cards; the block shows on the epoch page once the epoch has a page. */
    then_now: z.array(thenNowCard).length(3).optional(),
    /** Which fields are still provisional. `fallback_image` (a picture to be made) does not make the page test text; any other field does. */
    placeholder: z.array(z.enum(EPOCH_PLACEHOLDER_FIELDS)).default([]),
  })
  .superRefine((epoch, ctx) => {
    const need = (ok: boolean, field: string, why: string) => {
      if (!ok) ctx.addIssue({ code: 'custom', path: [field], message: `${field} is required when ${why}` });
    };
    const ids = (epoch.then_now ?? []).map((c) => c.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['then_now'], message: 'then_now ids must be different' });
    if (epoch.mvp) {
      need(epoch.years !== undefined, 'years', 'mvp is true');
      need(epoch.theme !== undefined, 'theme', 'mvp is true');
      need(epoch.style !== undefined, 'style', 'mvp is true');
    } else {
      need(epoch.years_label !== undefined, 'years_label', 'mvp is false');
    }
  });

export const threadSchema = z.strictObject({
  id: z.string(),
  /** Address part per language: /pt/fio/{slug}, /en/thread/{slug}. */
  slug: slugs,
  name: text,
  description: text,
  /** The colour of the dot in the light theme. */
  color: z.string(),
  /** The same colour, lighter, for the dark theme (3:1 against the dark page). */
  color_dark: z.string(),
  icon: z.string(),
  mvp: z.boolean(),
  placeholder: z.boolean().default(false),
});

/** One showcase entry; `id` is the id of an event. Order in the file is the display order. */
export const featuredSchema = z.strictObject({ id: z.string(), /** Position in featured.yaml; added by the loader (src/content.config.ts), not written in the file. */ position: z.number().int().optional() });
