// A strict reader of an RSS feed for the checks and the tests: sax in strict mode stops on any XML that is not well formed (an unclosed tag, a bare &, a bad
// attribute). Returns the channel and its items as plain objects. sax is a dev dependency (it was already in the lock through astro/svgo).
import sax from 'sax';

/**
 * @param {string} text
 * @returns {{ channel: Record<string, string>, items: Array<Record<string, any>>, selfLink: string | undefined }}
 */
export function parseFeed(text) {
  const parser = sax.parser(true, { trim: true });
  const stack = [];
  const channel = {};
  const items = [];
  let item = null;
  let selfLink;
  let open = '';
  parser.onopentag = (node) => {
    stack.push(node.name);
    open = '';
    if (node.name === 'item') item = { enclosures: [] };
    else if (node.name === 'enclosure' && item) item.enclosures.push({ ...node.attributes });
    else if (node.name === 'guid' && item) item.guidIsPermaLink = node.attributes.isPermaLink;
    else if (node.name === 'atom:link' && node.attributes.rel === 'self') selfLink = node.attributes.href;
  };
  parser.ontext = (s) => {
    open += s;
  };
  parser.oncdata = (s) => {
    open += s;
  };
  parser.onclosetag = (name) => {
    stack.pop();
    if (name === 'item') {
      items.push(item);
      item = null;
    } else if (item && stack.at(-1) === 'item') item[name] = open;
    else if (!item && stack.at(-1) === 'channel') channel[name] = open;
    open = '';
  };
  parser.onerror = (e) => {
    throw e;
  };
  parser.write(text).close();
  return { channel, items, selfLink };
}
