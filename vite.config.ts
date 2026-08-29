import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite does not serve /api in dev the way Vercel does in production, so this
 * wires the same handler into the dev server. One code path, two environments —
 * no "works locally, breaks on deploy" surprise at 4am.
 */
function apiDev(): Plugin {
  return {
    name: 'weave-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        res.setHeader('content-type', 'application/json');
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const mod = await server.ssrLoadModule('/api/analyze.ts');
          res.end(JSON.stringify(await mod.analyze(body)));
        } catch (err) {
          res.end(
            JSON.stringify({
              items: [],
              mode: 'fallback',
              warnings: [`Dev API error: ${(err as Error).message}`],
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDev()],
  server: { host: true, port: 5173 },
});
