import { describe, expect, it } from 'vitest';

import { parseClassNames } from '../../src/utils/css-parser';

// ─── helpers ────────────────────────────────────────────────────────────────

function css(strings: TemplateStringsArray, ...values: unknown[]) {
  return String.raw({ raw: strings }, ...values);
}

function expectClasses(input: string, ...names: string[]) {
  expect(parseClassNames(input)).toEqual(new Set(names));
}

function expectAbsent(result: Set<string> | null, ...names: string[]) {
  for (const name of names) {
    expect(result?.has(name), `"${name}" should not be extracted`).toBe(false);
  }
}

// ─── basic flat selectors ────────────────────────────────────────────────────

describe('basic flat selectors', () => {
  it('extracts a single class', () => {
    expectClasses(
      css`
        .foo {
          display: flex;
        }
      `,
      'foo'
    );
  });

  it('extracts multiple flat classes', () => {
    expectClasses(
      css`
        .container {
          min-width: 1024px;
        }
        .wrapper {
          position: relative;
        }
      `,
      'container',
      'wrapper'
    );
  });

  it('extracts classes with hyphens and underscores', () => {
    expectClasses(
      css`
        .foo-bar {
          display: flex;
        }
        .bar-foo {
          display: flex;
        }
        .alreadyCamelCased {
          display: flex;
        }
        .snake_cased {
          display: flex;
        }
      `,
      'foo-bar',
      'bar-foo',
      'alreadyCamelCased',
      'snake_cased'
    );
  });

  it('extracts classes from comma-separated top-level selectors', () => {
    expectClasses(
      css`
        .local1 {
        }
        .local2 {
        }
        .local3 {
        }
        .local4 {
        }
        .local5 .local6 {
        }
      `,
      'local1',
      'local2',
      'local3',
      'local4',
      'local5',
      'local6'
    );
  });

  it('extracts classes that use composes (single)', () => {
    expectClasses(
      css`
        .foo {
          font-weight: 300;
        }
        .bar {
          color: red;
          composes: foo;
        }
        .baz {
          composes: other from './otherfile';
          color: blue;
        }
      `,
      'foo',
      'bar',
      'baz'
    );
  });

  it('extracts classes that use composes (multiple)', () => {
    expectClasses(
      css`
        .foo {
          font-weight: 300;
        }
        .tar {
          color: black;
        }
        .bar {
          color: red;
          composes: foo tar;
        }
        .baz {
          composes: other from './otherfile';
          color: blue;
        }
      `,
      'foo',
      'tar',
      'bar',
      'baz'
    );
  });
});

// ─── compound selectors & child combinators ──────────────────────────────────

describe('compound selectors and child combinators', () => {
  it('extracts classes from a descendant compound selector (.foo .bar)', () => {
    expectClasses(
      css`
        .foo {
          width: 100px;
        }
        .bar {
          height: 100%;
        }
        .bar .bold {
          font-weight: bold;
        }
      `,
      'foo',
      'bar',
      'bold'
    );
  });

  it('extracts classes from child combinator rules; ignores universal selector', () => {
    // .wrapper > * — only 'wrapper' is a class; * adds nothing
    expectClasses(
      css`
        .wrapper {
          padding: 20px;
        }
        .wrapper > * {
          color: red;
        }
        .content {
          margin: 10px;
        }
        .content > * {
          color: red;
        }
        .content .nested {
          font-weight: bold;
        }
        .sidebar {
          width: 250px;
        }
        .footer {
          background: #f5f5f5;
        }
      `,
      'wrapper',
      'content',
      'nested',
      'sidebar',
      'footer'
    );
  });

  it('extracts classes from comma-separated compound selectors', () => {
    // .foo_baz, .foo_bar { } — both names from one rule
    expectClasses(
      css`
        .foo {
          font-weight: 300;
        }
        .foo_baz,
        .foo_bar {
          width: 100px;
        }
      `,
      'foo',
      'foo_baz',
      'foo_bar'
    );
  });

  it('extracts from comma-separated top-level selectors with descendants', () => {
    expectClasses(
      css`
        .foo,
        .bar {
          font-weight: 300;
        }
        .foo_baz {
          font-weight: 300;
        }
        .bar_baz {
          font-weight: 300;
        }
      `,
      'foo',
      'bar',
      'foo_baz',
      'bar_baz'
    );
  });
});

// ─── nested styles ───────────────────────────────────────────────────────────

describe('nested styles', () => {
  it('extracts all classes from deeply nested native CSS', () => {
    expectClasses(
      css`
        .container {
          padding: 20px;
          .header {
            font-size: 24px;
            .title {
              font-weight: bold;
            }
            .subtitle {
              font-weight: normal;
            }
          }
          .content {
            margin: 10px 0;
            .text {
              line-height: 1.5;
            }
            .highlight {
              background-color: yellow;
            }
          }
          .footer {
            border-top: 1px solid #ccc;
          }
        }
      `,
      'container',
      'header',
      'title',
      'subtitle',
      'content',
      'text',
      'highlight',
      'footer'
    );
  });

  it('extracts classes nested inside @media blocks', () => {
    expectClasses(
      css`
        .card {
          border: 1px solid #ddd;
        }
        .cardHeader {
          padding: 16px;
        }
        .cardBody {
          padding: 16px;
        }
        .cardFooter {
          padding: 12px;
        }
        @media (max-width: 768px) {
          .card {
            .cardHeader {
              padding: 12px;
            }
            .mobileOnly {
              display: block;
            }
          }
        }
      `,
      'card',
      'cardHeader',
      'cardBody',
      'cardFooter',
      'mobileOnly'
    );
  });

  it('extracts classes inside nesting with composes; deduplicates repeated names', () => {
    // .icon appears in two nested contexts but the Set deduplicates it
    expectClasses(
      css`
        .baseButton {
          padding: 8px 16px;
        }
        .primaryButton {
          composes: baseButton;
          .icon {
            margin-right: 8px;
          }
          .label {
            font-weight: 500;
          }
          &:hover {
            .icon {
              transform: scale(1.1);
            }
          }
        }
        .secondaryButton {
          composes: baseButton;
        }
        .unusedNested {
          display: none;
        }
      `,
      'baseButton',
      'primaryButton',
      'icon',
      'label',
      'secondaryButton',
      'unusedNested'
    );
  });
});

// ─── @keyframes ──────────────────────────────────────────────────────────────

describe('@keyframes', () => {
  it('extracts only CSS classes, not keyframe animation names', () => {
    const result = parseClassNames(css`
      @keyframes blink1 {
        from {
          fill-opacity: 0.1;
        }
        50% {
          fill-opacity: 1;
        }
        100% {
          fill-opacity: 0.1;
        }
      }
      @keyframes slideIn {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(0);
        }
      }
      .container {
        animation: blink1 2s infinite;
      }
      .slide {
        animation: slideIn 0.5s ease-out;
      }
    `);
    expect(result).toEqual(new Set(['container', 'slide']));
    expectAbsent(result, 'blink1', 'slideIn');
  });

  it('handles complex keyframe names with hyphens, underscores, and numbers', () => {
    const result = parseClassNames(css`
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes slide-out {
        0% {
          transform: translateX(0);
        }
        100% {
          transform: translateX(100%);
        }
      }
      @keyframes bounce_anim {
        0%,
        100% {
          transform: translateY(0);
        }
        40% {
          transform: translateY(-30px);
        }
      }
      @keyframes complexAnim123 {
        0% {
          opacity: 0;
        }
        100% {
          opacity: 1;
        }
      }
      .animated-element {
        animation: fadeIn 1s ease-in;
      }
      .sliding-box {
        animation: slide-out 0.5s linear;
      }
      .bouncing-ball {
        animation: bounce_anim 2s infinite;
      }
      .complex-anim {
        animation: complexAnim123 1.5s;
      }
      @media (prefers-reduced-motion: no-preference) {
        @keyframes spinSlow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .spinner {
          animation: spinSlow 3s linear infinite;
        }
      }
    `);
    expect(result).toEqual(
      new Set([
        'animated-element',
        'sliding-box',
        'bouncing-ball',
        'complex-anim',
        'spinner',
      ])
    );
    expectAbsent(
      result,
      'fadeIn',
      'slide-out',
      'bounce_anim',
      'complexAnim123',
      'spinSlow'
    );
  });
});

// ─── :export blocks ──────────────────────────────────────────────────────────

describe(':export blocks', () => {
  it('does not extract :export property names as CSS classes', () => {
    expectClasses(
      css`
        .bar {
          color: blue;
        }
        :export {
          myProp: something;
        }
      `,
      'bar'
    );
  });

  it('handles multiple :export properties without extracting them', () => {
    expectClasses(
      css`
        .bar {
          color: blue;
        }
        :export {
          otherProp: something;
          anotherProp: else;
        }
      `,
      'bar'
    );
  });
});

// ─── :global() selectors ─────────────────────────────────────────────────────

describe(':global() selectors', () => {
  it('does not extract classes wrapped in :global()', () => {
    const result = parseClassNames(css`
      .fullWidth {
        width: 100%;
        :global(.Button-root) {
          width: 100%;
        }
        :global(.Button-label) {
          color: blue;
        }
      }
      .container {
        padding: 20px;
        :global(.external-library-class) {
          color: red;
        }
      }
      .wrapper {
        position: relative;
      }
    `);
    expect(result).toEqual(new Set(['fullWidth', 'container', 'wrapper']));
    expectAbsent(
      result,
      'Button-root',
      'Button-label',
      'external-library-class'
    );
  });

  it('does not extract deeply nested :global() class names', () => {
    const result = parseClassNames(css`
      .card {
        .cardHeader {
          :global(.Typography-h1) {
            font-size: 24px;
          }
          .cardTitle {
            :global(.Icon-root) {
              margin-left: 8px;
            }
          }
        }
        .cardBody {
          :global(.Button-root) {
            :global(.Button-startIcon) {
              margin-right: 4px;
            }
          }
        }
        :global(.Paper-root) {
          background: white;
        }
      }
      .sidebar {
        :global(.Drawer-paper) {
          width: inherit;
        }
      }
    `);
    expect(result).toEqual(
      new Set(['card', 'cardHeader', 'cardTitle', 'cardBody', 'sidebar'])
    );
    expectAbsent(
      result,
      'Typography-h1',
      'Icon-root',
      'Button-root',
      'Button-startIcon',
      'Paper-root',
      'Drawer-paper'
    );
  });

  it('handles &:global() and :global() & combinator patterns', () => {
    // &:global(.expanded) — .expanded is in global scope, not local
    // :global(.theme-dark) & — .theme-dark is global
    const result = parseClassNames(css`
      .layout {
        &:global(.expanded) {
          width: 100%;
        }
        &:not(:global(.collapsed)) {
          padding: 20px;
        }
        :global(.theme-dark) & {
          background: #333;
        }
        .content {
          :global(.Table-root),
          :global(.TableContainer-root) {
            width: 100%;
          }
          .section {
            :global(.Accordion-root.expanded) {
              margin: 16px 0;
            }
          }
        }
      }
      .button {
        &:global(.Mes-active) {
          :global(.MesButton-label) {
            color: white;
          }
        }
      }
      .unusedClass {
        color: red;
      }
    `);
    expect(result).toEqual(
      new Set(['layout', 'content', 'section', 'button', 'unusedClass'])
    );
    expectAbsent(
      result,
      'expanded',
      'collapsed',
      'theme-dark',
      'Mes-active',
      'MesButton-label',
      'Table-root',
      'Accordion-root'
    );
  });
});

// ─── pseudo-classes with local class selectors ───────────────────────────────

describe('pseudo-classes containing local class selectors', () => {
  it('extracts :local() classes and ignores :global() classes', () => {
    const result = parseClassNames(css`
      .container {
        :global(.Button-root) {
          margin: 10px;
        }
        :local(.localButton) {
          background: blue;
        }
        .header {
          :global(.Typography-h1) {
            color: black;
          }
          :local(.title) {
            font-weight: bold;
          }
        }
      }
      .sidebar {
        :global(.Drawer-paper, .Drawer-root) {
          background: white;
        }
      }
      .footer {
        margin-top: 20px;
      }
      .unusedClass {
        color: red;
      }
    `);
    expect(result).toEqual(
      new Set([
        'container',
        'localButton',
        'header',
        'title',
        'sidebar',
        'footer',
        'unusedClass',
      ])
    );
    expectAbsent(
      result,
      'Button-root',
      'Typography-h1',
      'Drawer-paper',
      'Drawer-root'
    );
  });

  it('extracts classes from :not(), :where(), :is(), :has() while filtering :global()', () => {
    // :not(.disabled) → disabled is a local class, should be extracted
    // :where(.active, .focus) → both extracted
    // :where(:global(.GlobalActive), .localActive) → only localActive extracted
    // :is(.primary, .secondary, :global(.Button)) → primary + secondary extracted
    const result = parseClassNames(css`
      .card {
        &:not(.disabled) {
          cursor: pointer;
        }
        &:not(:global(.Disabled)) {
          opacity: 1;
        }
        :where(.active, .focus) {
          outline: 2px solid blue;
        }
        :where(:global(.GlobalActive), .localActive) {
          background: yellow;
        }
        .content {
          &:not(.hidden) {
            display: block;
          }
          &:not(:global(.Hidden)) {
            visibility: visible;
          }
        }
      }
      .button {
        &:is(.primary, .secondary, :global(.Button)) {
          border-radius: 4px;
        }
        &:has(.icon) {
          padding-left: 12px;
        }
      }
      .active {
        color: blue;
      }
      .primary {
        background: blue;
      }
      .icon {
        margin-right: 4px;
      }
    `);
    expect(result).toEqual(
      new Set([
        'card',
        'disabled',
        'active',
        'focus',
        'localActive',
        'content',
        'hidden',
        'button',
        'primary',
        'secondary',
        'icon',
      ])
    );
    expectAbsent(result, 'Disabled', 'GlobalActive', 'Hidden', 'Button');
  });

  it('handles deeply nested pseudo-class combinations with :global()', () => {
    // :where(.responsive) → responsive
    // &:is(.expanded):not(.collapsed):where(.interactive) → all three local
    // :local(.mobile-optimized) inside a :global block → still extracted
    // &:hover:not(:global(.disabled)) → .disabled is global, not extracted
    const result = parseClassNames(css`
      .layout {
        :where(.responsive) {
          &:not(:global(.desktop-only)) {
            :local(.mobile-optimized) {
              font-size: 14px;
            }
          }
        }
        &:is(.expanded):not(.collapsed):where(.interactive) {
          transform: scale(1.05);
        }
        :global(.Container-root .Grid-item) {
          padding: 8px;
        }
        .section {
          &:has(.title):not(:global(.Section-empty)) {
            border-left: 4px solid blue;
          }
          &:hover:focus {
            outline: 2px solid red;
          }
          &:hover:not(:global(.disabled)) {
            cursor: pointer;
          }
        }
      }
      .modal {
        &::before {
          content: '';
        }
        :global(.Backdrop-root) {
          &:local(.custom-backdrop) {
            background: rgba(0, 0, 0, 0.8);
          }
        }
      }
      .responsive {
        width: 100%;
      }
      .expanded {
        height: auto;
      }
      .interactive {
        user-select: none;
      }
      .title {
        font-weight: bold;
      }
      .custom-backdrop {
        z-index: 1000;
      }
      .unusedClass {
        display: none;
      }
    `);
    expect(result).toEqual(
      new Set([
        'layout',
        'responsive',
        'mobile-optimized',
        'expanded',
        'collapsed',
        'interactive',
        'section',
        'title',
        'modal',
        'custom-backdrop',
        'unusedClass',
      ])
    );
    expectAbsent(
      result,
      'Container-root',
      'Grid-item',
      'Section-empty',
      'Backdrop-root',
      'desktop-only',
      'disabled'
    );
  });
});

// ─── edge cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('returns an empty set for empty CSS content', () => {
    expect(parseClassNames('')).toEqual(new Set());
  });

  it('returns null for unparsable CSS instead of throwing', () => {
    expect(parseClassNames('safslf f sf')).toBeNull();
  });

  it('parses SCSS syntax when specified', () => {
    const result = parseClassNames(
      css`
        .card {
          border: 1px solid #ccc;
          .header {
            font-weight: bold;
          }
          .body {
            padding: 8px;
          }
        }
      `,
      'scss'
    );
    expect(result).toEqual(new Set(['card', 'header', 'body']));
  });

  // Regression: &:not(.selected) in SCSS — the class nested inside :not() must
  // be extracted. The original eslint-plugin-css-modules had this bug.
  it('extracts class referenced inside &:not() in SCSS (regression)', () => {
    const result = parseClassNames(
      css`
        .root {
          &:not(.selected) {
            opacity: 0.5;
          }
        }
      `,
      'scss'
    );
    expect(result).toEqual(new Set(['root', 'selected']));
  });
});
