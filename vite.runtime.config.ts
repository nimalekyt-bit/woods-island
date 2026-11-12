import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'runtime',
  publicDir: false,
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  esbuild: {
    jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
    tsconfigRaw: { compilerOptions: { jsx: 'react', jsxFactory: 'React.createElement', jsxFragmentFactory: 'React.Fragment' } },
  },
  build: {
    outDir: '../dist', emptyOutDir: true, target: 'chrome105',
    minify: 'esbuild', sourcemap: process.env.WOODS_SOURCEMAP === '1',
    modulePreload: { polyfill: false },
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: { ...Object.fromEntries(['index', 'settings', 'overlay', 'editor'].map(name => [name, resolve('runtime', `${name}.html`)])), 'runtime-debug': resolve('runtime/diagnostics.ts') },
      output: {
        entryFileNames: chunk => chunk.name === 'runtime-debug' ? 'assets/runtime-debug.js' : 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (id.includes('/runtime/vendor/react-foundation.js') || id.endsWith('/runtime/react.ts')) return 'vendor-react';
          if (id.includes('/runtime/vendor/motion.js')) return 'vendor-motion';
          if (id.includes('/runtime/vendor/editor.js')) return 'vendor-editor';
        },
      },
    },
  },
});
