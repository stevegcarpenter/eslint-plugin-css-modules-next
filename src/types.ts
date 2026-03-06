export interface CssModuleInfo {
  filePath: string;
  classNames: Set<string>;
}

// Future: allow users to configure file extensions, naming patterns, etc.
export type RuleOptions = Record<string, never>;
