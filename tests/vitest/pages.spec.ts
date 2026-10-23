import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, STATIC_PAGES, type StaticKey } from '../../src/data/static-pages';
import { LANGS } from '../../src/i18n/routes';
import { LAST_EPOCH_KEY, pickLastEpoch } from '../../src/lib/home';
import { MIN_REPORT_LENGTH, formsubmitEndpoint, hasEnoughText, pageFromQuery, reportSubject, sameSiteUrl, titleFromQuery } from '../../src/lib/report';
import { escapeHtml, renderInline } from '../../src/lib/static-text';

const KEYS = ['about', 'method', 'legal'] as StaticKey[];
const link = (key: string) => (['about', 'method', 'report', 'legal', 'map'].includes(key) ? { href: `/x/${key}/`, label: `T-${key}` } : undefined);

describe('static pages', () => {
  it('have the same sections, in the same order, in the three languages', () => {
    for (const key of KEYS) {
      const ids = LANGS.map((lang) => STATIC_PAGES[key][lang].sections.map((s) => s.id).join('|'));
      expect(new Set(ids).size, key).toBe(1);
    }
  });
  it('have the same number of paragraphs and list items in every language, and nothing empty', () => {
    for (const key of KEYS) {
      const shape = LANGS.map((lang) => STATIC_PAGES[key][lang].sections.map((s) => `${s.paragraphs.length}/${s.items?.length ?? 0}`).join(' '));
      expect(new Set(shape).size, key).toBe(1);
      for (const lang of LANGS) {
        const page = STATIC_PAGES[key][lang];
        if (page.lead !== undefined) expect(page.lead.trim().length, `${key} ${lang} lead`).toBeGreaterThan(40);
        for (const s of page.sections) {
          expect(s.heading.trim(), `${key} ${lang} ${s.id}`).not.toBe('');
          for (const p of [...s.paragraphs, ...(s.items ?? [])]) expect(p.trim(), `${key} ${lang} ${s.id}`).not.toBe('');
        }
      }
    }
  });
  it('use only tokens that exist and keep the same tokens in every language', () => {
    for (const key of KEYS) {
      const tokens = (lang: (typeof LANGS)[number]) => {
        const page = STATIC_PAGES[key][lang];
        const text = [page.lead ?? '', ...(page.more ?? []), ...page.sections.flatMap((s) => [...s.paragraphs, ...(s.items ?? []), ...(s.after ?? [])])].join(' ');
        return [...text.matchAll(/\{\{(\w+)(?:\|[^}]+)?\}\}/g)].map((m) => m[1]).sort().join(',');
      };
      expect(new Set(LANGS.map(tokens)).size, key).toBe(1);
      for (const lang of LANGS) {
        const page = STATIC_PAGES[key][lang];
        for (const s of page.sections) for (const p of [...s.paragraphs, ...(s.items ?? []), ...(s.after ?? [])]) expect(() => renderInline(p, link, CONTACT_EMAIL, { stories: '13 stories', ready: 'x', soon: 'y' })).not.toThrow();
        for (const p of [page.lead ?? 'x', ...(page.more ?? [])]) expect(() => renderInline(p, link, CONTACT_EMAIL, { stories: '13 stories', ready: 'x', soon: 'y' })).not.toThrow();
      }
    }
  });
  it('the Legal page names the licences, the browser storage and the form service in every language', () => {
    for (const lang of LANGS) {
      const text = STATIC_PAGES.legal[lang].sections.flatMap((s) => [...s.paragraphs, ...(s.items ?? [])]).join(' ');
      expect(text).toMatch(/MIT/);
      expect(text).toMatch(/CC BY-SA/);
      expect(text).toMatch(/FormSubmit/);
      expect(text).toMatch(/GitHub/);
      expect(text).toMatch(/OpenStreetMap/);
      expect(text).toMatch(/\{\{email\}\}/);
    }
  });
});

describe('inline markup', () => {
  it('escapes HTML and turns tokens into links', () => {
    expect(renderInline('a <b> & {{report}}', link, 'x@y.z')).toBe('a &lt;b&gt; &amp; <a href="/x/report/">T-report</a>');
    expect(renderInline('{{email}}', link, 'x@y.z')).toBe('<a href="mailto:x@y.z">x@y.z</a>');
    expect(escapeHtml(`"'`)).toBe('&quot;&#39;');
  });
  it('bold, a link with its own text, and a value computed by the page', () => {
    expect(renderInline('**Hook.** a', link, 'x@y.z')).toBe('<strong>Hook.</strong> a');
    expect(renderInline('в {{method|«Методе»}}', link, 'x@y.z')).toBe('в <a href="/x/method/">«Методе»</a>');
    expect(renderInline('всего {{stories}}.', link, 'x@y.z', { stories: '13 историй' })).toBe('всего 13 историй.');
    expect(renderInline('{{stories}}', link, 'x@y.z', { stories: '<b>' })).toBe('&lt;b&gt;');
  });
  it('fails on an unknown token', () => {
    expect(() => renderInline('{{nope}}', link, 'x@y.z')).toThrow(/nope/);
  });
});

describe('the mistake report form', () => {
  it('posts to FormSubmit for the project address', () => {
    expect(formsubmitEndpoint(CONTACT_EMAIL, false)).toBe('https://formsubmit.co/elefantefugiu@gmail.com');
    expect(formsubmitEndpoint(CONTACT_EMAIL, true)).toBe('https://formsubmit.co/ajax/elefantefugiu@gmail.com');
    expect(CONTACT_EMAIL).toBe('elefantefugiu@gmail.com');
  });
  it('names the language in the subject', () => {
    expect(reportSubject('ru')).toContain('(ru)');
  });
  it('needs a few characters of description', () => {
    expect(hasEnoughText('')).toBe(false);
    expect(hasEnoughText('   a  ')).toBe(false);
    expect(hasEnoughText('x'.repeat(MIN_REPORT_LENGTH))).toBe(true);
  });
  it('takes the page from ?url= only when it is an http(s) address', () => {
    expect(pageFromQuery('?url=https%3A%2F%2Fa.pt%2Fpt%2Fhistoria%2Fx%2F')).toBe('https://a.pt/pt/historia/x/');
    expect(pageFromQuery('?url=javascript%3Aalert(1)')).toBe('');
    expect(pageFromQuery('?url=https%3A%2F%2Fa.pt%2F%3Cscript%3E')).toBe('');
    expect(pageFromQuery('')).toBe('');
  });
});

describe('"Continue" on the home page', () => {
  it('accepts only an epoch that has a page', () => {
    const known = ['avis-e-descobrimentos', 'pombal-e-terramoto'];
    expect(pickLastEpoch('pombal-e-terramoto', known)).toBe('pombal-e-terramoto');
    expect(pickLastEpoch(' pombal-e-terramoto ', known)).toBe('pombal-e-terramoto');
    expect(pickLastEpoch('lusitania-e-roma', known)).toBeNull();
    expect(pickLastEpoch('', known)).toBeNull();
    expect(pickLastEpoch(null, known)).toBeNull();
    expect(pickLastEpoch('constructor', known)).toBeNull();
    expect(LAST_EPOCH_KEY).toBe('lastEpoch');
  });
});

describe('the text of the service pages follows the names on the site', () => {
  const everything = (lang: (typeof LANGS)[number]) =>
    KEYS.flatMap((key) => {
      const page = STATIC_PAGES[key][lang];
      return [page.lead ?? '', ...(page.more ?? []), ...page.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.items ?? []), ...(s.after ?? [])])];
    }).join(' ');
  it('uses the names of the labels, the buttons and the eras as the site writes them', () => {
    const pt = everything('pt');
    expect(pt).toContain('Em debate');
    expect(pt).toContain('Surpreende-me');
    // The names of the eras are not typed in the text any more: they come from the data ({{ready}}, src/lib/ready-epochs.ts).
    expect(pt).toContain('{{ready}}');
    expect(pt).not.toMatch(/Surpreenda-me|fuga da corte|Revolução dos Cravos»/);
    expect(everything('ru')).toContain('{{ready}}');
    const en = everything('en');
    expect(en).toContain('Debated');
    expect(en).toContain('Get directions');
    expect(en).toContain('{{ready}}');
    expect(en).toContain('{{soon}}');
    expect(en).not.toMatch(/Disputed|How to get there|Age of Discovery|Carnation Revolution/);
  });
  it('leaves out what stood in square brackets in the source files (placeholders and notes)', () => {
    for (const lang of LANGS) expect(everything(lang), lang).not.toMatch(/\[[^\]]+\]/);
  });
});

describe('the form arrives from a story', () => {
  it('takes the title from ?title=, as plain text of limited length', () => {
    expect(titleFromQuery('?title=Os%20tripeiros')).toBe('Os tripeiros');
    expect(titleFromQuery('?title=a%0A%09b%20%20c')).toBe('a b c');
    expect(titleFromQuery('')).toBe('');
    expect(titleFromQuery(`?title=${'x'.repeat(500)}`).length).toBe(200);
    expect(titleFromQuery('?title=%3Cb%3Ex%3C%2Fb%3E')).toBe('<b>x</b>'); // text only: the page puts it in with textContent
  });
  it('offers the way back only to an address of this site', () => {
    expect(sameSiteUrl('https://a.pt/pt/historia/x/', 'https://a.pt')).toBe(true);
    expect(sameSiteUrl('https://evil.example/', 'https://a.pt')).toBe(false);
    expect(sameSiteUrl('not a url', 'https://a.pt')).toBe(false);
    expect(sameSiteUrl('https://a.pt.evil.example/', 'https://a.pt')).toBe(false);
  });
});
