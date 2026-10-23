// The fixture build: what the test copy of the content looks like (prepare-variant.mjs writes it, data.mjs reads it, so the suites
// know the numbers without hardcoding them). The real content is never touched: the build runs in a copy outside the repository,
// and only the dist/ of that copy is served for the suites that need cards the real site does not have.
//
// The fixtures are the draft stand-ins evento-exemplo-17..24 (status "draft": they are not on the real site):
//   17 18 19 20 22  published here and moved to the epoch Avis (with years inside it), so that this epoch has more than 8 cards (the
//                   view switch "Timeline / Grid" appears from 9) and holds a heavy-topic card (19) and a 12+ card;
//   21 23 24        published here in the epoch Estado Novo, all of them 16+: the age screen "16+" and an epoch that every family mode
//                   leaves empty;
// and the marker limit of the map is lowered to 7 (in the copy only), because the real limit (30) is above the number of stories:
// with it the map has clusters and the "Show more" button, which the map suites check.
export const MOVED = ['evento-exemplo-17', 'evento-exemplo-18', 'evento-exemplo-19', 'evento-exemplo-20', 'evento-exemplo-22'];
export const SIXTEEN = ['evento-exemplo-21', 'evento-exemplo-23', 'evento-exemplo-24'];
/** The limit of markers on the map in the fixture build (the real one is DEFAULT_LIMIT in src/lib/markers.ts). */
export const VARIANT_MARKER_LIMIT = 7;
export const MOVED_TO = 'avis-e-descobrimentos';
export const FIXTURE_EPOCH = 'estado-novo-e-25-de-abril';

/** The card as the fixture build has it. Real (ready) cards stay as they are. */
export function variantOf(event) {
  if (event.status !== 'draft') return event;
  const out = { ...event, status: 'ready' };
  const moved = MOVED.indexOf(event.id);
  if (moved >= 0) {
    out.epoch = MOVED_TO;
    out.year = 1400 + moved * 30;
    delete out.year_label;
  } else if (SIXTEEN.includes(event.id)) {
    out.min_age = '16';
  }
  return out;
}
