// The claims of src/content/myths.yaml, read and checked once. For pages; the rules are in myths.ts.
import { parse } from 'yaml';
import raw from '../content/myths.yaml?raw';
import { mythListSchema, type MythData } from '../data/schemas';

export const MYTHS: readonly MythData[] = mythListSchema.parse(parse(raw));
