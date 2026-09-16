import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command }) => ({
  // Relative asset URLs make the same build work at / and /any-project-name/.
  base: './',
  plugins: [react(), tailwindcss(), {
    name: 'privacy-content-security-policy',
    transformIndexHtml(html) {
      if (command !== 'build') return html;
      const policy = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";
      return html.replace('<!-- production-csp -->', `<meta http-equiv="Content-Security-Policy" content="${policy}">`);
    }
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 850 },
  worker: { format: 'es' },
}));
