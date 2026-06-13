import { mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  clearCache,
  getCachedClassNames,
  setCacheLimit,
} from '../../src/utils/css-cache';

let dir: string;

/**
 * Write `content` to `name` and pin its mtime to a fixed whole-second epoch so
 * the cache key (mtimeMs) is fully deterministic across writes.
 */
function write(name: string, content: string, epochSeconds: number): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  const when = new Date(epochSeconds * 1000);
  utimesSync(path, when, when);
  return path;
}

/**
 * Overwrite a file's content WITHOUT changing its cache key — rewrites the
 * content but restores the previous mtime. The cache cannot tell the file
 * changed, so a fresh result here proves the entry was re-read for some other
 * reason (eviction or clearCache), not because of invalidation.
 */
function forgeStale(path: string, content: string): void {
  const { atime, mtime } = statSync(path);
  writeFileSync(path, content);
  utimesSync(path, atime, mtime);
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'css-cache-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  clearCache();
  setCacheLimit(15);
});

describe('getCachedClassNames', () => {
  it('returns the parsed class set', () => {
    const path = write('a.module.css', '.foo {} .bar {}', 1000);
    expect(getCachedClassNames(path)).toEqual(new Set(['foo', 'bar']));
  });

  it('returns the same cached instance when the file is unchanged', () => {
    const path = write('a.module.css', '.foo {}', 1000);
    const first = getCachedClassNames(path);
    const second = getCachedClassNames(path);
    expect(second).toBe(first);
  });

  it('returns null for a missing file (and does not cache the miss)', () => {
    const path = join(dir, 'does-not-exist.module.css');
    expect(getCachedClassNames(path)).toBeNull();
    // Creating it afterwards must be picked up.
    write('does-not-exist.module.css', '.late {}', 1000);
    expect(getCachedClassNames(path)).toEqual(new Set(['late']));
  });
});

describe('invalidation', () => {
  it('re-parses when the file changes (new mtime)', () => {
    const path = write('b.module.css', '.foo {}', 1000);
    expect(getCachedClassNames(path)).toEqual(new Set(['foo']));

    write('b.module.css', '.foo {} .bar {}', 2000);
    expect(getCachedClassNames(path)).toEqual(new Set(['foo', 'bar']));
  });

  it('re-parses on an mtime change even when the size is identical', () => {
    // `.aaa` and `.bbb` are the same byte length, so only mtime differs.
    const path = write('c.module.css', '.aaa {}', 1000);
    expect(getCachedClassNames(path)).toEqual(new Set(['aaa']));

    write('c.module.css', '.bbb {}', 2000);
    expect(getCachedClassNames(path)).toEqual(new Set(['bbb']));
  });

  it('serves the cached value when mtime and size are unchanged', () => {
    const path = write('d.module.css', '.foo {}', 1000);
    expect(getCachedClassNames(path)).toEqual(new Set(['foo']));

    // Same key as before → stale value is intentionally returned.
    forgeStale(path, '.bar {}');
    expect(getCachedClassNames(path)).toEqual(new Set(['foo']));
  });
});

describe('disabled (limit 0)', () => {
  it('re-parses every call and stores nothing when the limit is 0', () => {
    setCacheLimit(0);
    const path = write('disabled.module.css', '.foo {}', 1000);
    expect(getCachedClassNames(path)).toEqual(new Set(['foo']));

    // Same mtime would normally be served stale; with caching off it re-reads.
    forgeStale(path, '.bar {}');
    expect(getCachedClassNames(path)).toEqual(new Set(['bar']));
  });

  it('still returns null for a missing file when disabled', () => {
    setCacheLimit(0);
    expect(getCachedClassNames(join(dir, 'nope.module.css'))).toBeNull();
  });
});

describe('clearCache', () => {
  it('forces a re-read even when the cache key is unchanged', () => {
    const path = write('e.module.css', '.foo {}', 1000);
    expect(getCachedClassNames(path)).toEqual(new Set(['foo']));

    forgeStale(path, '.bar {}');
    clearCache();
    expect(getCachedClassNames(path)).toEqual(new Set(['bar']));
  });
});

describe('LRU eviction', () => {
  it('evicts the oldest entry past the limit', () => {
    setCacheLimit(2);
    const f1 = write('f1.module.css', '.aaa {}', 1000);
    const f2 = write('f2.module.css', '.aaa {}', 1000);
    const f3 = write('f3.module.css', '.aaa {}', 1000);

    getCachedClassNames(f1); // [f1]
    getCachedClassNames(f2); // [f1, f2]
    getCachedClassNames(f3); // [f2, f3] — f1 evicted

    // f1 was evicted → re-read despite an unchanged key.
    forgeStale(f1, '.zzz {}');
    expect(getCachedClassNames(f1)).toEqual(new Set(['zzz']));
    // f3 is still cached → stale value returned.
    forgeStale(f3, '.zzz {}');
    expect(getCachedClassNames(f3)).toEqual(new Set(['aaa']));
  });

  it('treats a cache hit as most-recently-used (touch)', () => {
    setCacheLimit(2);
    const f1 = write('g1.module.css', '.aaa {}', 1000);
    const f2 = write('g2.module.css', '.aaa {}', 1000);
    const f3 = write('g3.module.css', '.aaa {}', 1000);

    getCachedClassNames(f1); // [f1]
    getCachedClassNames(f2); // [f1, f2]
    getCachedClassNames(f1); // [f2, f1] — f1 touched, f2 now oldest
    getCachedClassNames(f3); // [f1, f3] — f2 evicted

    // f1 survived because it was touched.
    forgeStale(f1, '.zzz {}');
    expect(getCachedClassNames(f1)).toEqual(new Set(['aaa']));
    // f2 was evicted.
    forgeStale(f2, '.zzz {}');
    expect(getCachedClassNames(f2)).toEqual(new Set(['zzz']));
  });

  it('shrinking the limit evicts immediately', () => {
    const f1 = write('h1.module.css', '.aaa {}', 1000);
    const f2 = write('h2.module.css', '.aaa {}', 1000);
    const f3 = write('h3.module.css', '.aaa {}', 1000);

    getCachedClassNames(f1);
    getCachedClassNames(f2);
    getCachedClassNames(f3); // [f1, f2, f3]

    setCacheLimit(1); // keep only the newest, f3

    forgeStale(f1, '.zzz {}');
    forgeStale(f2, '.zzz {}');
    forgeStale(f3, '.zzz {}');

    // Check the survivor first: each subsequent read re-caches its file under
    // the limit of 1, which would evict f3.
    expect(getCachedClassNames(f3)).toEqual(new Set(['aaa'])); // still cached
    expect(getCachedClassNames(f1)).toEqual(new Set(['zzz'])); // evicted
    expect(getCachedClassNames(f2)).toEqual(new Set(['zzz'])); // evicted
  });
});
