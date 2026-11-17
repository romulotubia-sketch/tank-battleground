import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import playgamaBridge from '@playgama/bridge/vite';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function servePlaygamaZipPlugin(): Plugin {
  const zipFiles = [
    '/tankbound-arena-playgama.zip',
    '/tankbound-arena-playgama-updated.zip',
  ];
  return {
    name: 'serve-playgama-zip',
    configureServer(server) {
      for (const route of zipFiles) {
        const fileName = route.slice(1);
        server.middlewares.use(route, (_req, res, next) => {
          const zipPath = path.resolve(import.meta.dirname, fileName);
          if (!fs.existsSync(zipPath)) {
            next();
            return;
          }
          const stat = fs.statSync(zipPath);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Length', String(stat.size));
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          res.setHeader('Cache-Control', 'no-store');
          fs.createReadStream(zipPath).pipe(res);
        });
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), playgamaBridge({ mode: 'local' }), servePlaygamaZipPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1850,
      rolldownOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/phaser')) {
              return 'vendor-phaser';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/motion')) {
              return 'vendor-ui';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
