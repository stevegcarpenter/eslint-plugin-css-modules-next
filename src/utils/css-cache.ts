import { statSync } from 'fs';

import type { ClassLocation } from '../types';
import { extractClassLocations } from './css-parser';

/**
 * Module-level cache of parsed CSS-module class sets, shared across every rule
 * and every linted file in a process.
 *
 * What is cached: the *raw* class definitions parsed from a CSS module file (or
 * `null` when the file is missing/unparseable) — both the `Set<string>` of names
 * and a `Map` of name → source position, derived from a single parse. Usage
 * analysis and `localsConvention` expansion are intentionally NOT cached — they
 * are cheap and depend on per-file / per-config state, so callers recompute them.
 *
 * Invalidation: each entry is validated on every access against the file's
 * `mtimeMs`. If it differs, the file is re-parsed. This keeps long-running
 * editor/LSP sessions correct when a CSS file changes between lint passes.
 * (Editing the *importing* file is always correct because the used-class
 * analysis is rederived from the AST on every pass.)
 *
 * Memory: bounded LRU. The `Map` preserves insertion order, so the oldest key
 * is evicted once the cache grows past `cacheLimit`. A small limit is safe —
 * eviction only ever forces a re-parse, never an incorrect result.
 *
 * See the "Why caching matters" section of the README for the rationale and
 * benchmark numbers.
 */
interface CacheEntry {
  mtimeMs: number;
  classNames: Set<string> | null;
  locations: Map<string, ClassLocation> | null;
}

/**
 * Parse a CSS module file once into both the name set and the position map. A
 * single parse keeps the two views consistent and avoids reading the file twice.
 */
function parse(filePath: string): {
  classNames: Set<string> | null;
  locations: Map<string, ClassLocation> | null;
} {
  const locations = extractClassLocations(filePath);
  return {
    classNames: locations && new Set(locations.keys()),
    locations,
  };
}

const DEFAULT_CACHE_LIMIT = 15;

const cache = new Map<string, CacheEntry>();
let cacheLimit = DEFAULT_CACHE_LIMIT;

/**
 * Set the maximum number of CSS files kept in the cache. A limit of `0` (or
 * less) disables caching entirely — every lookup re-parses from disk.
 * Shrinking the limit evicts the oldest entries immediately.
 */
export function setCacheLimit(limit: number): void {
  cacheLimit = Math.max(0, Math.floor(limit));
  evict();
}

/** Clear the entire cache. Primarily for tests. */
export function clearCache(): void {
  cache.clear();
}

function evict(): void {
  while (cache.size > cacheLimit) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Mark a key as most-recently-used by reinserting it at the end. */
function touch(filePath: string, entry: CacheEntry): void {
  cache.delete(filePath);
  cache.set(filePath, entry);
}

/**
 * Returns the raw set of local class names defined in a CSS module file, using
 * a cached result when the file is unchanged since the last parse.
 *
 * Returns `null` when the file is missing, unreadable, or unparseable.
 *
 * The returned `Set` is the cached instance — callers must treat it as
 * read-only (do not mutate it).
 */
function getEntry(filePath: string): CacheEntry | null {
  let mtimeMs: number;
  try {
    mtimeMs = statSync(filePath).mtimeMs;
  } catch {
    // Missing or unreadable file — do not cache, since the file may appear
    // later (and there is no stat to key an invalidation on).
    cache.delete(filePath);
    return null;
  }

  // Caching disabled — always parse fresh and store nothing.
  if (cacheLimit <= 0) return { mtimeMs, ...parse(filePath) };

  const existing = cache.get(filePath);
  if (existing && existing.mtimeMs === mtimeMs) {
    touch(filePath, existing);
    return existing;
  }

  const entry: CacheEntry = { mtimeMs, ...parse(filePath) };
  touch(filePath, entry);
  evict();
  return entry;
}

export function getCachedClassNames(filePath: string): Set<string> | null {
  return getEntry(filePath)?.classNames ?? null;
}

/**
 * Returns a map of each local class name defined in a CSS module file to its
 * 1-based source position, using a cached result when the file is unchanged
 * since the last parse.
 *
 * Returns `null` when the file is missing, unreadable, or unparseable. The
 * returned `Map` is the cached instance — callers must treat it as read-only.
 */
export function getCachedClassLocations(
  filePath: string
): Map<string, ClassLocation> | null {
  return getEntry(filePath)?.locations ?? null;
}
