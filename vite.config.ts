import { defineConfig, loadEnv, type Plugin } from 'vite';
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

/**
 * Server-side secrets that api/analyze.ts reads from process.env.
 * Deliberately NOT VITE_ prefixed — a VITE_ variable is inlined into the
 * browser bundle, which is exactly how API keys end up scraped.
 */
const SERVER_ENV = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'ANTHROPIC_MODEL',
  'GEMINI_MODEL',
];

export default defineConfig(({ mode }) => {
  // Vite reads .env files, but only ever exposes VITE_ prefixed values, and
  // only to the client. Nothing puts an unprefixed key into process.env, so
  // the dev-server API handler would never see it — it worked on Vercel
  // (which injects env vars itself) and silently failed locally. Load the
  // env files here and hand the server keys to process.env explicitly.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of SERVER_ENV) {
    // A real shell variable still wins over the file.
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }

  return {
    plugins: [react(), apiDev()],
    server: { host: true, port: 5173 },
  };
});
