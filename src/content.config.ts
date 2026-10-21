import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { parse } from 'yaml';
import { epochSchema, eventSchema, featuredSchema, threadSchema } from './data/schemas';

const events = defineCollection({
  // One YAML file per event; the file name (without extension) is the entry id.
  loader: glob({
    pattern: '*.yaml',
    base: './src/content/events',
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ''),
  }),
  schema: eventSchema,
});

const epochs = defineCollection({ loader: file('src/content/epochs.yaml'), schema: epochSchema });
const threads = defineCollection({ loader: file('src/content/threads.yaml'), schema: threadSchema });
// The loader keeps no order of its own (entries come back sorted by id), so the position in the list is added to every entry.
const featured = defineCollection({
  loader: file('src/content/featured.yaml', { parser: (text) => (parse(text) as object[]).map((entry, position) => ({ ...entry, position })) }),
  schema: featuredSchema,
});

export const collections = { events, epochs, threads, featured };
