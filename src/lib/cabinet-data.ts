// What the pages and the script of the cabinet need from the data, per language: the texts of the rarities, the addresses, the strings. Used by the page of the cabinet,
// by /{lang}/cabinet.json (read by src/scripts/cabinet.ts when the page has a hidden word or a sardine, or the preview of the owner is on) and by the card in the hub of the games.
import { festaPath, pagePath, storyPath, withBase, type Lang } from '../i18n/routes';
import { section, t } from '../i18n';
import { festasIn } from './festas-data';
import { tinSvg } from './cabinet-art';
import type { SiteData } from './site-data';

export interface ItemData {
  name: string;
  summary: string;
  hint: string;
  /** The address of the story of the rarity. */
  href: string;
  epoch: string;
  image: string | null;
  /** The age data of the rarity (the stricter of its host and its story): the family mode counts only what it shows. */
  minAge: string;
  sensitive: boolean;
}

export function cabinetItems(site: SiteData, lang: Lang): Record<string, ItemData> {
  const stories = new Map([...site.events, ...site.cabinetStories].map((e) => [e.id, e]));
  return Object.fromEntries(
    site.cabinet.map(({ item, age }) => [
      item.id,
      {
        name: item.name[lang],
        summary: item.summary[lang],
        hint: item.hint[lang],
        href: storyPath(lang, stories.get(item.story)!.slug[lang]),
        epoch: site.epochs.find((e) => e.id === item.epoch)?.name[lang] ?? '',
        image: item.image ? withBase(item.image) : null,
        minAge: String(age.minAge),
        sensitive: Boolean(age.sensitive),
      } satisfies ItemData,
    ]),
  );
}

/** The page of the holiday of the sardines, when it exists in this language (the finished cabinet links to it). */
export const partyHref = (lang: Lang): string | null => {
  const festa = festasIn(lang).find((f) => f.id === 'santos-populares');
  return festa ? festaPath(lang, festa.slug) : null;
};

/** The card of the cabinet in the hub of the games, as HTML (the same markup as the other two cards in src/views/GamesView.astro; the picture is a stand-in until the real one). */
export const hubCardHtml = (lang: Lang): string =>
  `<li data-cabinet-card><a class="game-card" href="${pagePath(lang, 'cabinet')}" data-game-card="cabinet"><figure class="game-card__figure"><div class="cab-card-art">${tinSvg(3, 'hub')}</div></figure>` +
  `<span class="game-card__text"><h2 class="game-card__name">${t(lang, 'pages.cabinet.title')}</h2><span class="game-card__line">${t(lang, 'games.cabinet_line')}</span></span></a></li>`;

/** The link of the footer. */
export const footerLinkHtml = (lang: Lang): string => `<li data-cabinet-link><a href="${pagePath(lang, 'cabinet')}">${t(lang, 'footer.cabinet')}</a></li>`;

export function cabinetPayload(site: SiteData, lang: Lang) {
  return {
    strings: section(lang, 'cabinet'),
    items: cabinetItems(site, lang),
    partyHref: partyHref(lang),
    href: pagePath(lang, 'cabinet'),
    hubCard: hubCardHtml(lang),
    footerLink: footerLinkHtml(lang),
    games: pagePath(lang, 'games'),
  };
}
