import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    minify: false,
    rollupOptions: {
      external: [/node:.*/],
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
    coverage: {
      provider: 'istanbul', // or 'c8'
      reporter: ['text', 'json', 'html']
    },
  }
})