import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5173
  },
  build: {
    outDir: 'dist',
    // Hashed build output goes to /static so it stays separate from the
    // verbatim copies of public/assets. Only /static/* is cached immutably
    // (see public/_headers) because only those filenames carry a hash.
    assetsDir: 'static',
    sourcemap: false
  }
});
