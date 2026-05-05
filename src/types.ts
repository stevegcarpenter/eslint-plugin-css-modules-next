export interface CssModuleInfo {
  filePath: string;
  classNames: Set<string>;
}

/**
 * Mirrors the css-loader / Vite `css.modules.localsConvention` setting so
 * that the lint rules understand how kebab-case CSS class names are exposed
 * to JavaScript at runtime.
 *
 * - `"asIs"` — class names are exposed exactly as written in CSS (default).
 * - `"camelCase"` — both the original name **and** a camelCase alias exist.
 * - `"camelCaseOnly"` — only the camelCase alias exists at runtime.
 */
export type LocalsConvention = 'asIs' | 'camelCase' | 'camelCaseOnly';

/**
 * Shared JSON Schema fragment for the `localsConvention` option.
 * Attach this to the `meta.schema` array of any rule that supports it.
 */
export const localsConventionSchema: Record<string, unknown>[] = [
  {
    type: 'object',
    properties: {
      localsConvention: {
        type: 'string',
        enum: ['asIs', 'camelCase', 'camelCaseOnly'],
        default: 'asIs',
      },
    },
    additionalProperties: false,
  },
];

// Future: allow users to configure file extensions, naming patterns, etc.
export type RuleOptions = Record<string, never>;
