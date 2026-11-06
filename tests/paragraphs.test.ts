import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { moreParagraphs, storyParagraphs } from '../src/lib/paragraphs';

// The YAML block styles that occur in src/content/events: what they give and what the page makes of it.
const read = (yaml: string): string => parse(yaml).t as string;

test('story: a blank line in a folded block is a paragraph break, a line wrap is a space', () => {
  const t = read('t: >-\n  One two\n  three.\n\n  Four five.\n');
  assert.deepEqual(storyParagraphs(t), ['One two three.', 'Four five.']);
});

test('story: one paragraph stays one', () => {
  assert.deepEqual(storyParagraphs(read('t: >-\n  One two\n  three.\n')), ['One two three.']);
});

test('more: folded block with two blank lines between paragraphs', () => {
  const t = read('t: >-\n  One two\n  three.\n\n\n  Four five.\n');
  assert.deepEqual(moreParagraphs(t), ['One two three.', 'Four five.']);
});

test('more: literal block, wraps are single newlines, paragraphs are separated by two blank lines', () => {
  const t = read('t: |-\n  One two\n  three.\n\n\n  Four\n  five.\n');
  assert.deepEqual(moreParagraphs(t), ['One two three.', 'Four five.']);
});

test('more: literal block with doubled newlines (a few English texts) keeps the wraps inside the paragraph', () => {
  const t = read('t: |-\n  One two\n\n  three.\n\n\n\n  Four\n\n  five.\n');
  assert.deepEqual(moreParagraphs(t), ['One two three.', 'Four five.']);
});

test('more: a literal block of one paragraph is not cut at its wraps', () => {
  assert.deepEqual(moreParagraphs(read('t: |-\n  One two\n  three\n  four.\n')), ['One two three four.']);
});
