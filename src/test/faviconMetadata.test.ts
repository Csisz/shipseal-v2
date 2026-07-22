import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');

describe('ShipSeal favicon and app metadata', () => {
  it('uses ShipSeal title, description, and SVG favicon', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');

    expect(html).toContain('<title>ShipSeal - AI Repository Optimization Platform</title>');
    expect(html).toContain('<meta name="description" content="Stop wasting AI context. Turn repositories into AI-optimized workspaces." />');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />');
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    expect(existsSync(resolve(root, 'public', 'favicon.svg'))).toBe(true);
  });

  it('does not keep the old default favicon.ico asset', () => {
    expect(existsSync(resolve(root, 'public', 'favicon.ico'))).toBe(false);
  });

  it('defines a dynamic-viewport fullscreen fallback with all four safe-area insets', () => {
    const css = readFileSync(resolve(root, 'src', 'index.css'), 'utf8');

    expect(css).toContain('.repository-universe-fullscreen');
    expect(css).toContain('@supports (height: 100dvh)');
    expect(css).toContain('height: 100dvh');
    expect(css).toContain('env(safe-area-inset-top)');
    expect(css).toContain('env(safe-area-inset-right)');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('env(safe-area-inset-left)');
  });
});
