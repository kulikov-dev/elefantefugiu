import { describe, expect, it } from 'vitest';
import { FOLLOW_KEY, followEvent, kitAction, showFollow } from '../../src/lib/follow';

describe('kitAction and followEvent', () => {
  it('each language posts to its own Kit form and has its own event', () => {
    expect(kitAction('ru')).toBe('https://app.kit.com/forms/10212790/subscriptions');
    expect(kitAction('en')).toBe('https://app.kit.com/forms/10212921/subscriptions');
    expect(kitAction('pt')).toBe('https://app.kit.com/forms/10212936/subscriptions');
    expect(followEvent('pt')).toBe('subscribe-pt');
    expect(FOLLOW_KEY).toBeTruthy();
  });
});

describe('showFollow', () => {
  it('a newcomer (nothing read, or only this story) does not see it', () => {
    expect(showFollow([], 'a', false)).toBe(false);
    expect(showFollow(['a'], 'a', false)).toBe(false);
  });
  it('a reader of another story sees it, until closed or subscribed', () => {
    expect(showFollow(['b'], 'a', false)).toBe(true);
    expect(showFollow(['a', 'b'], 'a', false)).toBe(true);
    expect(showFollow(['b'], 'a', true)).toBe(false);
  });
});
