import type { Rule } from 'eslint';

import { setCacheLimit } from './css-cache';

/**
 * Apply plugin-wide options from the shared ESLint `settings` object.
 *
 * Configured in flat config as:
 *
 *   settings: { 'css-modules-next': { cacheSize: 15 } }
 *
 * The cache is shared across every rule, so its size lives in shared settings
 * rather than in any single rule's options.
 */
export function applyCacheSettings(context: Rule.RuleContext): void {
  const pluginSettings = (context.settings as Record<string, unknown>)?.[
    'css-modules-next'
  ] as { cacheSize?: unknown } | undefined;

  const cacheSize = pluginSettings?.cacheSize;
  if (typeof cacheSize === 'number' && Number.isFinite(cacheSize)) {
    setCacheLimit(cacheSize);
  }
}
