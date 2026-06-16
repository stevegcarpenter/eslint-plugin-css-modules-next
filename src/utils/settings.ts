import type { Rule } from 'eslint';

import type { LocalsConvention } from '../types';
import { setCacheLimit } from './css-cache';

const LOCALS_CONVENTIONS: readonly LocalsConvention[] = [
  'asIs',
  'camelCase',
  'camelCaseOnly',
];

function isLocalsConvention(value: unknown): value is LocalsConvention {
  return (
    typeof value === 'string' &&
    (LOCALS_CONVENTIONS as readonly string[]).includes(value)
  );
}

/**
 * Read the plugin-wide `settings['css-modules-next']` block, if present.
 */
function getPluginSettings(
  context: Rule.RuleContext
): Record<string, unknown> | undefined {
  return (context.settings as Record<string, unknown>)?.['css-modules-next'] as
    | Record<string, unknown>
    | undefined;
}

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
  const cacheSize = getPluginSettings(context)?.cacheSize;
  if (typeof cacheSize === 'number' && Number.isFinite(cacheSize)) {
    setCacheLimit(cacheSize);
  }
}

/**
 * Resolve the effective `localsConvention` for a rule invocation.
 *
 * Precedence (highest first):
 *   1. The rule's own option — `{ localsConvention }` in the rule config.
 *   2. The shared `settings['css-modules-next'].localsConvention` block, which
 *      acts as one source of truth across every rule.
 *   3. The `'asIs'` default.
 *
 * This lets users set the convention once in shared settings and have it apply
 * to all rules, while still allowing any single rule to override it.
 */
export function resolveLocalsConvention(
  context: Rule.RuleContext
): LocalsConvention {
  const ruleOption = (context.options[0] as { localsConvention?: unknown })
    ?.localsConvention;
  if (isLocalsConvention(ruleOption)) {
    return ruleOption;
  }

  const sharedOption = getPluginSettings(context)?.localsConvention;
  if (isLocalsConvention(sharedOption)) {
    return sharedOption;
  }

  return 'asIs';
}
