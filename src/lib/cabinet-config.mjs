// The switch of the cabinet of rarities (docs/spec.md, "Кабинет редкостей"). One line: null while the cabinet is closed, or the day it opens ('YYYY-MM-DD',
// the day in Lisbon, like the day of a queued story). The daily build (deploy.yml) opens everything by itself on that day.
// The environment variable CABINET_OPENS overrides it (the stand-in builds of the tests; "null" closes). Plain JavaScript: the scripts import it too.
import { buildToday, cabinetOpen } from './publication.mjs';

const fromEnv = typeof process === 'undefined' ? undefined : process.env.CABINET_OPENS?.trim();
export const CABINET_OPENS = fromEnv ? (fromEnv === 'null' ? null : fromEnv) : null;

/** Is the cabinet open in this build? */
export const isCabinetOpen = (today = buildToday()) => cabinetOpen(CABINET_OPENS, today);
