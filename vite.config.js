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
      formats: ['es', 'cjs', 'umd'],
    },
  }
})