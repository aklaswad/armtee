import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    minify: false,
    rollupOptions: {
      external: [/node:.*/, /yargs*/],
    },
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'armtee',
      fileName: 'index',
      copyPublicDir: false,
      sourcemap: true
    },
  },
  test: {
    globals: true,
    deps: {
      inline: ['vitest-mock-process'],
    },
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html']
    },
  }
})