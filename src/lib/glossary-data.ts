// The words of src/data/glossary.yaml, read and checked once (scripts/check-data.ts checks them against the stories and the holidays). For pages.
import { parse } from 'yaml';
import raw from '../data/glossary.yaml?raw';
import { glossaryListSchema, type GlossaryTerm } from '../data/schemas';

export const GLOSSARY: readonly GlossaryTerm[] = glossaryListSchema.parse(parse(raw));
