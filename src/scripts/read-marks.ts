// "Read" marks: records the story whose end has been seen after enough time on the page, shows the tick in the lists, "read N of M" on the
// epoch page and the reset button of the legal page. Everything is in try/catch: without localStorage the site works as before. Nothing is
// sent anywhere (no counter event).
import { READ_DELAY_MS, READ_KEY, addRead, parseRead, readProgress, type StoryOnPage } from '../lib/read-marks';
import { pickPlural } from '../lib/plural-pick';
import { currentFamilyMode, onFamilyChange } from './family-mode';

const load = (): string[] => {
  try {
    return parseRead(localStorage.getItem(READ_KEY));
  } catch {
    return [];
  }
};
const save = (list: string[]): void => {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(list));
  } catch {
    // Blocked storage: the mark is simply not kept.
  }
};

/** The age data of a story in a list sits on the item that holds it (data-min-age, data-sensitive); without it the story is shown in every mode. */
function onPage(): StoryOnPage[] {
  return [...document.querySelectorAll<HTMLElement>('[data-story]')].map((el) => {
    const holder = el.closest<HTMLElement>('[data-min-age]');
    return { id: el.dataset.story ?? '', minAge: holder?.dataset.minAge, sensitive: holder?.dataset.sensitive };
  });
}

/** The tick in the lists, and "read N of M" on the epoch page (only the stories the mode shows). */
function show(): void {
  const read = load();
  const done = new Set(read);
  document.querySelectorAll<HTMLElement>('[data-story]').forEach((el) => el.toggleAttribute('data-read', done.has(el.dataset.story ?? '')));
  const progress = document.querySelector<HTMLElement>('[data-read-progress]');
  if (progress) {
    const { n, m } = readProgress(onPage(), read, currentFamilyMode());
    const d = progress.dataset;
    // "read N of M" agrees with N (Portuguese "lida 1 de 11", "lidas 2 de 11"): the form comes from Intl.PluralRules of the page.
    const forms = { p_one: d.one ?? '', p_few: d.few ?? '', p_many: d.many ?? '', p_other: d.other ?? '' };
    progress.textContent = pickPlural(forms, 'p', n, d.locale ?? 'en').replace('{n}', String(n)).replace('{m}', String(m));
    progress.toggleAttribute('data-shown', n > 0);
  }
}

/**
 * The story is marked when two things have happened: its end came into view, and the page has been open for READ_DELAY_MS with the tab
 * visible (time with the tab hidden does not count). Leaving the page before that marks nothing. A test may shorten the wait with
 * window.__readDelayMs.
 */
function watchEnd(): void {
  const end = document.querySelector<HTMLElement>('[data-story-end]');
  const id = end?.dataset.storyEnd;
  if (!end || !id || !('IntersectionObserver' in window)) return;
  const override = (window as unknown as { __readDelayMs?: unknown }).__readDelayMs;
  const delay = typeof override === 'number' && override >= 0 ? override : READ_DELAY_MS;
  let seen = false;
  let visibleMs = 0;
  let last = performance.now();
  const check = (): void => {
    if (!seen || visibleMs < delay) return;
    clearInterval(timer);
    observer.disconnect();
    save(addRead(load(), id));
  };
  const timer = window.setInterval(() => {
    const now = performance.now();
    if (document.visibilityState === 'visible') visibleMs += now - last;
    last = now;
    check();
  }, 250);
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      seen = true;
      check();
    }
  });
  observer.observe(end);
}

/** The button of the legal page. */
function watchReset(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-read-reset]');
  if (!button) return;
  const status = document.querySelector<HTMLElement>('[data-read-reset-status]');
  button.addEventListener('click', () => {
    try {
      localStorage.removeItem(READ_KEY);
    } catch {
      // Blocked storage: there is nothing to reset.
    }
    if (status) status.textContent = button.dataset.done ?? '';
    show();
  });
}

show();
onFamilyChange(show);
watchEnd();
watchReset();
