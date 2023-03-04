import monaco from 'rollup-plugin-monaco-editor';
export default {
  base: '/armtee/',
  plugins: [
    monaco({ languages: ['javascript'] }),
  ],
}
