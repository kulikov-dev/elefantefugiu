import { describe, expect, it } from 'vitest';
import { picture } from '../../src/data/schemas';
import { authorText, cardPicture, epochPicture, needsAttribution, previewPicture, sourceName, type PictureData } from '../../src/lib/pictures';

const base = {
  file: 'cantino-1502.webp',
  alt: { pt: 'a', en: 'b', ru: 'c' },
  caption: { pt: 'a', en: 'b', ru: 'c' },
  author: 'Someone',
  license: 'Public domain',
  source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg',
};

describe('picture schema', () => {
  it('accepts a full picture and fills ai with false', () => {
    expect(picture.parse(base).ai).toBe(false);
  });

  it('takes a focus point like "20% 55%" and refuses anything else', () => {
    expect(picture.parse({ ...base, focus: '20% 55%' }).focus).toBe('20% 55%');
    expect(() => picture.parse({ ...base, focus: 'left top' })).toThrow();
    expect(() => picture.parse({ ...base, focus: '20 55' })).toThrow();
  });

  it('the author is a name or a text per language', () => {
    expect(() => picture.parse({ ...base, author: { pt: 'Autor desconhecido', en: 'Unknown author' } })).not.toThrow();
  });

  it('refuses the old fields and a typo (strict)', () => {
    expect(() => picture.parse({ ...base, credit: 'x' })).toThrow();
    expect(() => picture.parse({ ...base, src: 'images/x.svg' })).toThrow();
  });

  it('needs a caption and the file', () => {
    const { caption: _caption, ...noCaption } = base;
    expect(() => picture.parse(noCaption)).toThrow();
    const { file: _file, ...noFile } = base;
    expect(() => picture.parse(noFile)).toThrow();
  });
});

describe('which picture a card shows', () => {
  const own = { ...base, ai: false } as unknown as PictureData;
  const epochOwn = { ...base, file: 'epoca-avis.webp', ai: true } as unknown as PictureData;

  it('the own picture first, then the epoch picture', () => {
    expect(cardPicture({ image: own }, { fallback_image: epochOwn })).toBe(own);
    expect(cardPicture({}, { fallback_image: epochOwn })).toBe(epochOwn);
  });

  it('a provisional path (a string) is not a picture', () => {
    expect(epochPicture({ fallback_image: 'images/placeholders/epoch-c.svg' })).toBeUndefined();
    expect(cardPicture({}, { fallback_image: 'images/placeholders/epoch-c.svg' })).toBeUndefined();
  });

  it('a heavy topic gives its place in previews to the epoch picture', () => {
    expect(previewPicture({ image: own, sensitive: true }, { fallback_image: epochOwn })).toBe(epochOwn);
    expect(previewPicture({ image: own, sensitive: false }, { fallback_image: epochOwn })).toBe(own);
    expect(previewPicture({ image: own, sensitive: true }, {})).toBeUndefined();
  });
});

describe('the credit line', () => {
  it('CC BY and CC BY-SA need the author and the licence link; the others do not', () => {
    expect(needsAttribution('CC BY 4.0')).toBe(true);
    expect(needsAttribution('CC BY-SA 2.0')).toBe(true);
    expect(needsAttribution('CC0')).toBe(false);
    expect(needsAttribution('Public domain')).toBe(false);
    expect(needsAttribution('AI-generated')).toBe(false);
  });

  it('the author in the language of the page', () => {
    expect(authorText({ author: 'Joseolgon' }, 'pt')).toBe('Joseolgon');
    expect(authorText({ author: { pt: 'Autor desconhecido', en: 'Unknown author', ru: 'Автор неизвестен' } }, 'ru')).toBe('Автор неизвестен');
  });

  it('names the source site', () => {
    expect(sourceName('https://commons.wikimedia.org/wiki/File:X.jpg')).toBe('Wikimedia Commons');
    expect(sourceName('https://www.example.org/a')).toBe('example.org');
    expect(sourceName('not an address')).toBe('not an address');
  });
});
