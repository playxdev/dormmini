import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // The version the menu screen shows. Read from package.json so a release is
  // one edit, and so a tenant reporting a bug names a build that exists.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
