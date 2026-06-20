import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base is '/tiny-havoc/' for the GitHub Pages build (served from a repo subpath),
// and '/' for local dev / preview.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tiny-havoc/' : '/',
  plugins: [react()],
  server: {
    host: true,                        // expose on the LAN (phone testing)
    allowedHosts: ['.trycloudflare.com'], // let the HTTPS dev tunnel through
  },
}));
