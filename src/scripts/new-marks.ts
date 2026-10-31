// "New since your last visit" (src/lib/new-marks.ts has the rules). On every page: the visit is kept in localStorage (key lastVisit: {prev, last}),
// and a story published after the day of `prev` that is not read gets data-new on its card or list item, which shows the mark "New" in the place of
// the "read" tick. On the home page also "+N new" on the epochs of the time strip and a line "Since your last visit: N new stories" with links
// to the epochs. An epoch whose every shown story is new is a new era: its cards carry no mark, the strip says "new era" instead of "+N", and the
// line speaks of epochs when all the new stories are in such epochs. Only the stories the family mode shows are counted. Without localStorage, nothing is marked. Nothing is sent anywhere.
import { VISIT_KEY, advanceVisit, isNewSince, newCounts, newEras, parseVisit, type EpochFirsts, type NewCandidate } from '../lib/new-marks';
import { pickPlural } from '../lib/plural-pick';
import { READ_KEY, parseRead } from '../lib/read-marks';
import { currentFamilyMode, onFamilyChange } from './family-mode';

let prev: number | null = null;
try {
  const next = advanceVisit(parseVisit(localStorage.getItem(VISIT_KEY)), Date.now());
  localStorage.setItem(VISIT_KEY, JSON.stringify(next));
  prev = next.prev;
} catch {
  // Blocked storage: no visit is known, nothing is marked.
}

const readList = (): string[] => {
  try {
    return parseRead(localStorage.getItem(READ_KEY));
  } catch {
    return [];
  }
};

const forms = (raw: string | undefined): Record<string, string> => {
  try {
    return JSON.parse(raw ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
};
/** The form for n (one, few, many, other: Intl.PluralRules of the page, in pickPlural) from a table of the forms of one string. */
const say = (table: Record<string, string>, n: number): string =>
  pickPlural(Object.fromEntries(Object.entries(table).map(([category, text]) => [`p_${category}`, text])), 'p', n, document.documentElement.lang || 'en').replace('{n}', String(n));

/** The day of the earliest story of every epoch for each family mode (BaseLayout puts it in every page). */
function epochFirsts(): EpochFirsts {
  try {
    return JSON.parse(document.querySelector('[data-epoch-firsts]')?.textContent ?? '{}') as EpochFirsts;
  } catch {
    return {};
  }
}

/** The mark on the cards and list items of the page, but not on the cards of an epoch that is new as a whole. */
function mark(): void {
  const read = new Set(readList());
  const eras = new Set(newEras(epochFirsts(), prev, currentFamilyMode()));
  document.querySelectorAll<HTMLElement>('[data-published]').forEach((el) => el.toggleAttribute('data-new', prev !== null && isNewSince(el.dataset.published ?? '', prev) && !read.has(el.dataset.story ?? '') && !eras.has(el.dataset.epoch ?? '')));
}

/** The home page: the counters of the epochs and the line with the links. */
function home(): void {
  const line = document.querySelector<HTMLElement>('[data-new-line]');
  const data = document.querySelector('[data-new-data]');
  if (!line || !data) return;
  let stories: NewCandidate[] = [];
  let targets: Record<string, { href: string; name: string }> = {};
  try {
    stories = JSON.parse(data.textContent ?? '[]');
    targets = JSON.parse(line.dataset.targets ?? '{}');
  } catch {
    return;
  }
  const { total, byEpoch, eras, whole } = newCounts(stories, readList(), prev, currentFamilyMode(), epochFirsts());
  const epochForms = forms(line.dataset.epochForms);
  document.querySelectorAll<HTMLElement>('[data-new-epoch]').forEach((el) => {
    const id = el.dataset.newEpoch ?? '';
    const n = byEpoch[id] ?? 0;
    const era = eras.includes(id);
    el.textContent = era ? (line.dataset.eraText ?? '') : n > 0 ? say(epochForms, n) : '';
    el.hidden = !era && n === 0;
  });
  line.hidden = total === 0;
  if (total === 0) return;
  line.textContent = '';
  // In the order of the epochs (the order of `targets`, which the page builds from the strip of epochs).
  const listed = Object.keys(targets).filter((id) => byEpoch[id]);
  line.append((line.dataset.template ?? '{text}').replace('{text}', whole ? say(forms(line.dataset.eraForms), Object.keys(byEpoch).length) : say(forms(line.dataset.forms), total)));
  listed.forEach((id, i) => {
    const a = document.createElement('a');
    a.href = targets[id]!.href;
    a.textContent = targets[id]!.name;
    line.append(i === 0 ? ' — ' : ', ', a);
  });
}

function show(): void {
  mark();
  home();
}

// The reset button of the legal page forgets the visit too: from then on this is a first visit.
document.querySelector('[data-read-reset]')?.addEventListener('click', () => {
  try {
    localStorage.removeItem(VISIT_KEY);
  } catch {
    // Blocked storage: there is nothing to reset.
  }
  prev = null;
  show();
});

show();
onFamilyChange(show);
