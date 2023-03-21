import { defineConfig } from 'vite';
//import monaco from 'rollup-plugin-monaco-editor';
//const prefix = `monaco-editor/esm/vs`;
export default defineConfig({
  base: '/armtee/',
  build: {
    outDir: './armtee',
  }
})
