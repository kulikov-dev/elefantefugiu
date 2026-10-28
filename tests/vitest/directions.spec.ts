import { describe, expect, it } from 'vitest';
import { googleDirectionsLink } from '../../src/lib/directions';

describe('googleDirectionsLink', () => {
  it('is a Google Maps directions link to the point', () => {
    expect(googleDirectionsLink(38.6999, -9.204)).toBe('https://www.google.com/maps/dir/?api=1&destination=38.6999,-9.204');
  });
  it('keeps five decimals (about a metre), no 15-digit floats', () => {
    expect(googleDirectionsLink(38.123456789, -9.987654321)).toBe('https://www.google.com/maps/dir/?api=1&destination=38.12346,-9.98765');
  });
  it('is an https link to google.com/maps only, with no other service', () => {
    const url = new URL(googleDirectionsLink(1, 2));
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('www.google.com');
    expect(url.pathname).toBe('/maps/dir/');
  });
});
