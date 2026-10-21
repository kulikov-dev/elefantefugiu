import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, STATIC_PAGES, type StaticKey } from '../../src/data/static-pages';
import { LANGS } from '../../src/i18n/routes';
import { LAST_EPOCH_KEY, pickLastEpoch } from '../../src/lib/home';
import { MIN_REPORT_LENGTH, formsubmitEndpoint, hasEnoughText, pageFromQuery, reportSubject } from '../../src/lib/report';
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
        expect(page.lead.trim().length, `${key} ${lang} lead`).toBeGreaterThan(40);
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
        const text = [page.lead, ...page.sections.flatMap((s) => [...s.paragraphs, ...(s.items ?? [])])].join(' ');
        return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');
      };
      expect(new Set(LANGS.map(tokens)).size, key).toBe(1);
      for (const lang of LANGS) {
        const page = STATIC_PAGES[key][lang];
        for (const s of page.sections) for (const p of [...s.paragraphs, ...(s.items ?? [])]) expect(() => renderInline(p, link, CONTACT_EMAIL)).not.toThrow();
        expect(() => renderInline(page.lead, link, CONTACT_EMAIL)).not.toThrow();
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
