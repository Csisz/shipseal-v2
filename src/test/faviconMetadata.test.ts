import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');

describe('ShipSeal favicon and app metadata', () => {
  it('uses ShipSeal title, description, and SVG favicon', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');

    expect(html).toContain('<title>ShipSeal - AI Project Delivery Pack Generator</title>');
    expect(html).toContain('<meta name="description" content="Seal your AI project before you ship it." />');
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    expect(existsSync(resolve(root, 'public', 'favicon.svg'))).toBe(true);
  });

  it('does not keep the old default favicon.ico asset', () => {
    expect(existsSync(resolve(root, 'public', 'favicon.ico'))).toBe(false);
  });
});
