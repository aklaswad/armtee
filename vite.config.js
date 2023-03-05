import monaco from 'rollup-plugin-monaco-editor';
export default {
  base: '/armtee/',
  build: {
    outDir: './site-dist'
  },
  plugins: [
    monaco({ languages: ['javascript'] }),
  ],
}
