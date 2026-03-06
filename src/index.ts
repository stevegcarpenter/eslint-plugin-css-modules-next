import type { Rule } from 'eslint';
import { version } from '../package.json';
import { rules } from './rules/index';

interface PluginMeta {
  name: string;
  version: string;
}

interface Plugin {
  meta: PluginMeta;
  rules: Record<string, Rule.RuleModule>;
  configs: Record<string, unknown>;
}

const plugin: Plugin = {
  meta: {
    name: 'eslint-plugin-css-modules-next',
    version,
  },
  rules,
  configs: {},
};

// Recommended config — references the plugin itself for flat config usage
plugin.configs['recommended'] = {
  plugins: { 'css-modules-next': plugin },
  rules: {
    'css-modules-next/invalid-css-module-filepath': 'error',
    'css-modules-next/no-dynamic-class-access': 'error',
    'css-modules-next/no-undefined-class': 'error',
    'css-modules-next/no-unused-class': 'error',
  },
};

export default plugin;
