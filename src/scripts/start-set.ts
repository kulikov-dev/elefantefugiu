// "Where to start" in the browser (the rules are in src/lib/start-set.ts, the build counted the same set for its own day with nothing read).
// Here the set is counted again with what the build cannot know: the day in Lisbon now, the stories this reader has read and the family mode.
// The data comes in a file of its own (src/lib/start-data.ts, one per language, named by its hash, so the browser keeps it); until it has come
// the page keeps the set it was built with.
// When the result is the set the page was built with, the page is not touched. When it differs, the cards are replaced by copies of blank cards
// the page carries (a copy keeps the scoped styles), and the list keeps its height until the window is resized, so the page below does not jump.
// `?hoje=YYYY-MM-DD` sets the day (for looking at an anniversary or a holiday; the build takes its day from SITE_TODAY). Nothing is sent anywhere.
import { isVisibleInMode, type MinAge } from '../lib/family';
import { lisbonToday } from '../lib/publication.mjs';
import { READ_KEY, parseRead } from '../lib/read-marks';
import { START_CARD_SIZES, type StartCardData } from '../lib/start-card';
import { pinsFor } from '../lib/start-pins';
import { setKey, startSet, withFallback, type Pin, type StartCardRef, type StartStory } from '../lib/start-set';
import { currentFamilyMode, onFamilyChange } from './family-mode';

interface StartData {
  fallback: string[];
  holidays: Pin[];
  stories: (StartStory & { minAge: MinAge })[];
  cards: Record<string, StartCardData>;
}

type Lang = 'pt' | 'en' | 'ru';

const section = document.querySelector<HTMLElement>('[data-showcase]');
const list = section?.querySelector<HTMLElement>('[data-start-list]') ?? null;
let data: StartData | null = null;

const lang = (['pt', 'en', 'ru'].includes(document.documentElement.lang) ? document.documentElement.lang : 'en') as Lang;

/** The day to count for: `?hoje=` when it is a real day, otherwise today in Lisbon. */
function today(): string {
  const asked = new URLSearchParams(location.search).get('hoje') ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(asked) && !Number.isNaN(Date.parse(`${asked}T00:00:00Z`)) ? asked : lisbonToday();
}

const readSet = (): Set<string> => {
  try {
    return new Set(parseRead(localStorage.getItem(READ_KEY)));
  } catch {
    return new Set();
  }
};

function compute(info: StartData): StartCardRef[] {
  const mode = currentFamilyMode();
  const stories = info.stories.filter((s) => isVisibleInMode({ minAge: s.minAge, sensitive: s.sensitive }, mode));
  const day = today();
  const pins = pinsFor(stories, Number(day.slice(0, 4)), info.holidays);
  return withFallback(startSet({ today: day, stories, read: readSet(), pins }), info.fallback.filter((id) => stories.some((s) => s.id === id)));
}

/** A card for one entry of the set, copied from the blank card of its label; null when the data for it is missing. */
function build(info: StartData, ref: StartCardRef, first: boolean): HTMLElement | null {
  let card: StartCardData | undefined;
  let name: string;
  let story: (typeof info.stories)[number] | undefined;
  if (ref.target.type === 'story') {
    story = info.stories.find((s) => s.id === (ref.target as { id: string }).id);
    card = info.cards[ref.target.id];
    name = card?.label ?? '';
  } else {
    card = { href: ref.target.href, title: ref.target.title[lang], hook: ref.target.hook[lang], ...(ref.target.image ? { img: { src: ref.target.image, alt: '' } } : {}) };
    name = 'page';
  }
  const template = section?.querySelector<HTMLTemplateElement>(`template[data-start-template="${name}"]`);
  const item = template?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
  const article = item?.querySelector<HTMLElement>('.start-card');
  if (!card || !item || !article) return null;
  if (story) {
    item.dataset.minAge = story.minAge;
    item.dataset.sensitive = String(story.sensitive);
    article.id = `c-${story.id}`;
    article.dataset.story = story.id;
    if (readSet().has(story.id)) article.setAttribute('data-read', '');
  }
  const caption = item.querySelector('.showcase__caption');
  if (caption) caption.textContent = ref.label?.[lang] ?? '';
  const hook = item.querySelector('.start-card__hook');
  if (hook) {
    hook.textContent = card.hook;
    if (card.hookLang) hook.setAttribute('lang', card.hookLang);
  }
  const link = item.querySelector<HTMLAnchorElement>('.start-card__title a');
  if (link) {
    link.textContent = card.title;
    link.href = card.href;
  }
  const meta = item.querySelector('[data-start-year-place]');
  if (meta && card.meta) meta.textContent = card.meta;
  if (!card.heavy) item.querySelector('.start-card__heavy')?.remove();
  if (card.img) {
    const img = document.createElement('img');
    img.className = 'start-card__image';
    img.src = card.img.src;
    if (card.img.srcset) {
      img.srcset = card.img.srcset;
      img.sizes = START_CARD_SIZES;
    }
    if (card.img.width && card.img.height) {
      img.width = card.img.width;
      img.height = card.img.height;
    }
    img.alt = card.img.alt;
    img.loading = first ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (card.img.pos) img.style.objectPosition = card.img.pos;
    article.prepend(img);
  }
  return item;
}

let held = false;
/** Counts the set and swaps the cards when it differs from the ones on the page. */
function update(): void {
  if (!data || !section || !list) return;
  const refs = compute(data);
  if (setKey(refs) === list.dataset.key) return;
  const items = refs.map((ref, i) => build(data!, ref, i === 0)).filter((item): item is HTMLElement => item !== null);
  if (items.length === 0) return;
  if (!held) {
    list.style.minHeight = `${list.offsetHeight}px`;
    held = true;
    window.addEventListener('resize', () => (list.style.minHeight = ''), { once: true });
  }
  list.replaceChildren(...items);
  list.dataset.key = setKey(refs);
  list.classList.toggle('showcase--captioned', refs.some((ref) => ref.label));
}

async function load(): Promise<void> {
  const url = section?.dataset.startUrl;
  if (!section || !list || !url) return;
  list.dataset.key = section.dataset.startKey ?? '';
  try {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) return;
    data = (await response.json()) as StartData;
  } catch {
    // Offline or blocked: the built set stays.
    return;
  }
  update();
  onFamilyChange(update);
  // Back from a story with the page restored from the cache: a story may have been read on the way.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) update();
  });
}

void load();
