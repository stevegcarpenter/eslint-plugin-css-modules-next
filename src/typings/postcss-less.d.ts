declare module 'postcss-less' {
  import type { Parser, Root, Stringifier } from 'postcss';
  export const parse: Parser<Root>;
  export const stringify: Stringifier;
}
