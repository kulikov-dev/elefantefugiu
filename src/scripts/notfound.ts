// The 404 page: shows the text in the language of the address that was not found (/pt/..., /en/..., /ru/...; the base path of a
// project site comes first, so the language is looked for anywhere in the path), else the saved choice or the browser language.
// Without this script the Portuguese text stays and the links to the three home pages are there.
import { chooseLang, isLang } from '../lib/lang-choice';
import { readPref } from './pref';

const fromPath = location.pathname.match(/\/(pt|en|ru)(?:\/|$)/)?.[1];
const lang = isLang(fromPath) ? fromPath : chooseLang(readPref('lang'), navigator.language);

for (const section of document.querySelectorAll<HTMLElement>('[data-notfound-lang]')) {
  const show = section.dataset.notfoundLang === lang;
  section.hidden = !show;
  if (show) {
    document.documentElement.lang = lang;
    if (section.dataset.title) document.title = `${section.dataset.title} · O Elefante Fugiu`;
  }
}
