import { mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import type { Rule } from 'eslint';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  clearCache,
  getCachedClassNames,
  setCacheLimit,
} from '../../src/utils/css-cache';
import {
  applyCacheSettings,
  resolveLocalsConvention,
} from '../../src/utils/settings';

let dir: string;

function write(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  const when = new Date(1000 * 1000);
  utimesSync(path, when, when);
  return path;
}

function forgeStale(path: string, content: string): void {
  const before = statSync(path);
  writeFileSync(path, content);
  utimesSync(path, before.atime, before.mtime);
}

/** Build a minimal RuleContext carrying only the shared `settings`. */
function contextWith(settings: unknown): Rule.RuleContext {
  return { settings } as Rule.RuleContext;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'css-settings-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  clearCache();
  setCacheLimit(15); // reset to the default baseline before each test
});

describe('applyCacheSettings', () => {
  it('applies cacheSize from shared settings', () => {
    applyCacheSettings(contextWith({ 'css-modules-next': { cacheSize: 1 } }));

    const f1 = write('a.module.css', '.aaa {}');
    const f2 = write('b.module.css', '.aaa {}');
    getCachedClassNames(f1); // [f1]
    getCachedClassNames(f2); // [f2] — f1 evicted at limit 1

    forgeStale(f1, '.zzz {}');
    expect(getCachedClassNames(f1)).toEqual(new Set(['zzz'])); // re-read
  });

  it('ignores a non-numeric cacheSize', () => {
    applyCacheSettings(contextWith({ 'css-modules-next': { cacheSize: '5' } }));
    // Default limit (15) remains, so two files coexist.
    const f1 = write('c.module.css', '.aaa {}');
    const f2 = write('d.module.css', '.aaa {}');
    getCachedClassNames(f1);
    getCachedClassNames(f2);

    forgeStale(f1, '.zzz {}');
    expect(getCachedClassNames(f1)).toEqual(new Set(['aaa'])); // still cached
  });

  it('does not throw when settings are absent', () => {
    expect(() => applyCacheSettings(contextWith({}))).not.toThrow();
    expect(() => applyCacheSettings(contextWith(undefined))).not.toThrow();
  });
});

/** Build a minimal RuleContext carrying rule options and shared settings. */
function contextWithOptions(
  options: unknown[],
  settings: unknown
): Rule.RuleContext {
  return { options, settings } as Rule.RuleContext;
}

describe('resolveLocalsConvention', () => {
  it('defaults to asIs when nothing is configured', () => {
    expect(resolveLocalsConvention(contextWithOptions([], {}))).toBe('asIs');
    expect(resolveLocalsConvention(contextWithOptions([], undefined))).toBe(
      'asIs'
    );
  });

  it('applies the shared settings value to all rules', () => {
    const ctx = contextWithOptions([], {
      'css-modules-next': { localsConvention: 'camelCase' },
    });
    expect(resolveLocalsConvention(ctx)).toBe('camelCase');
  });

  it('uses the per-rule option when only it is present', () => {
    const ctx = contextWithOptions([{ localsConvention: 'camelCaseOnly' }], {});
    expect(resolveLocalsConvention(ctx)).toBe('camelCaseOnly');
  });

  it('lets the per-rule option override shared settings', () => {
    const ctx = contextWithOptions([{ localsConvention: 'camelCaseOnly' }], {
      'css-modules-next': { localsConvention: 'camelCase' },
    });
    expect(resolveLocalsConvention(ctx)).toBe('camelCaseOnly');
  });

  it('falls back to shared settings when the rule option is invalid', () => {
    const ctx = contextWithOptions([{ localsConvention: 'bogus' }], {
      'css-modules-next': { localsConvention: 'camelCase' },
    });
    expect(resolveLocalsConvention(ctx)).toBe('camelCase');
  });

  it('ignores an invalid shared settings value', () => {
    const ctx = contextWithOptions([], {
      'css-modules-next': { localsConvention: 42 },
    });
    expect(resolveLocalsConvention(ctx)).toBe('asIs');
  });
});
