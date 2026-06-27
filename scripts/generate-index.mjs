/**
 * Post-build: call the SSR handler directly and write the rendered
 * HTML shell to dist/client/index.html so Vercel can serve it statically.
 */
import { writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const serverPath = join(__dirname, '..', 'dist', 'server', 'server.js');

if (!existsSync(serverPath)) {
  console.error('ERROR: dist/server/server.js not found. Run vite build first.');
  process.exit(1);
}

try {
  const { default: handler } = await import(serverPath);
  const req = new Request('http://localhost:3000/');
  const res = await handler.fetch(req, {}, {});

  if (res.status !== 200) {
    throw new Error(`SSR handler returned status ${res.status}`);
  }

  const html = await res.text();
  const outPath = join(__dirname, '..', 'dist', 'client', 'index.html');
  writeFileSync(outPath, html, 'utf-8');
  console.log('✓ Generated dist/client/index.html (' + html.length + ' bytes)');
} catch (error) {
  console.warn('WARNING: SSR failed during index generation. Using default Vite index.html fallback.', error);
}
