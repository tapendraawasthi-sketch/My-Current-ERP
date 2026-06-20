import http from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';

const __dirname = new URL('.', import.meta.url).pathname;
const PORT = parseInt(process.env.PORT || '3000');
const SSR_PORT = PORT + 1;

const MIME = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

process.env.PORT = String(SSR_PORT);
await import('./dist/server/server.js');
await new Promise(r => setTimeout(r, 1500));

http.createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0];
  const file = join(__dirname, 'dist/client', path);
  try {
    const s = await stat(file);
    if (s.isFile()) {
      const buf = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      return res.end(buf);
    }
  } catch {}
  const proxy = http.request({ hostname: '127.0.0.1', port: SSR_PORT, path: req.url, method: req.method, headers: req.headers }, pr => {
    res.writeHead(pr.statusCode, pr.headers);
    pr.pipe(res);
  });
  proxy.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(proxy);
}).listen(PORT, () => console.log('Ready on', PORT));
