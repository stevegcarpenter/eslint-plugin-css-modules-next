import { build } from 'esbuild';

const external = ['postcss', 'postcss-less', 'postcss-scss'];

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  external,
};

await Promise.all([
  build({
    ...shared,
    format: 'esm',
    outfile: 'dist/index.js',
  }),
  build({
    ...shared,
    format: 'cjs',
    outfile: 'dist/index.cjs',
  }),
]);

console.log('Build complete');
