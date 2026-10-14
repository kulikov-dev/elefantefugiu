// Zod schemas for the content collections (docs/spec.md section 7).
// Shared by src/content.config.ts (Astro) and scripts/check-data.ts (readable checks).
import { z } from 'astro/zod';

/** Text in both site languages. */
export const text = z.strictObject({ pt: z.string(), en: z.string() });

const slug = z.string();
const yearRange = z.strictObject({ from: z.number().int(), to: z.number().int() });

// YAML reads an unquoted 12 as a number, so accept 12 and "12" and always output a string:
// "all", "12" or "16" (decision after stage 2).
export const minAge = z.preprocess((v) => (typeof v === 'number' ? String(v) : v), z.enum(['all', '12', '16']));

const source = z.strictObject({
  title: z.string(),
  url: z.string(),
  type: z.string(),
  accessed: z.coerce.date(),
});

const image = z.strictObject({
  /** Path inside public/, for example images/placeholders/epoch-a.svg */
  src: z.string(),
  alt: text,
  /** Visible caption under the picture; optional. Credit and licence are always shown as well. */
  caption: text.optional(),
  credit: z.string(),
  license: z.string(),
});

const interactive = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('army_dots'),
    data: z.strictObject({
      /** People represented by one dot. */
      people_per_dot: z.number().positive(),
      groups: z
        .array(z.strictObject({ name: text, min: z.number().nonnegative(), max: z.number().nonnegative() }))
        .min(2),
    }),
  }),
  z.strictObject({
    type: z.literal('ship_scale'),
    data: z.strictObject({
      historic: z.strictObject({ name: text, length_m: z.number().positive() }),
      modern: z.strictObject({ name: text, length_m: z.number().positive() }),
    }),
  }),
]);

export const eventSchema = z.strictObject({
  id: z.string(),
  slug: z.strictObject({ pt: slug, en: slug }),
  // Not in the spec table, but the card needs a title (spec 5.3, block 2).
  title: text,
  epoch: z.string(),
  level: z.enum(['frame', 'story']),
  year: z.union([z.number().int(), yearRange]),
  year_label: text.optional(),
  place: z.strictObject({ name: z.string(), lat: z.number(), lon: z.number() }),
  bridge: z.strictObject({
    name: z.string(),
    address: z.string(),
    lat: z.number(),
    lon: z.number(),
    url: z.string(),
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
  image: image.optional(),
  related: z.array(z.string()).optional(),
  interactive: interactive.optional(),
  reviewed_by: z.string().optional(),
  reviewed_on: z.coerce.date().optional(),
  status: z.enum(['draft', 'ready']),
  placeholder: z.boolean().default(false),
});

export const epochSchema = z.strictObject({
  id: z.string(),
  order: z.number().int(),
  name: text,
  years: yearRange,
  theme: text,
  style: z.strictObject({
    bg: z.string(),
    accent: z.string(),
    heading_font: z.string(),
    frame: z.string(),
  }),
  mvp: z.boolean(),
  /** Preview image (Open Graph) for cards of this epoch that have no image of their own. Path inside public/. */
  fallback_image: z.string().optional(),
  placeholder: z.boolean().default(false),
});

export const threadSchema = z.strictObject({
  id: z.string(),
  name: text,
  description: text,
  color: z.string(),
  icon: z.string(),
  mvp: z.boolean(),
  placeholder: z.boolean().default(false),
});

/** One showcase entry; `id` is the id of an event. Order in the file is the display order. */
export const featuredSchema = z.strictObject({ id: z.string() });
