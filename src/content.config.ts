import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { epochSchema, eventSchema, featuredSchema, threadSchema, uiSchema } from './data/schemas';

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
const featured = defineCollection({ loader: file('src/content/featured.yaml'), schema: featuredSchema });
const ui = defineCollection({ loader: file('src/content/ui.yaml'), schema: uiSchema });

export const collections = { events, epochs, threads, featured, ui };
