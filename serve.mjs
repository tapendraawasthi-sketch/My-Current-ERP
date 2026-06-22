import http from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = parseInt(process.env.PORT || '3000');

const MIME = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.html': 'text/html',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
};

// Import the SSR server — it exports a Workers-style { fetch(request) } handler
const ssrServer = await import('./dist/server/server.js');
const ssrHandler = ssrServer.default;

http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  // 1. Try to serve static files from dist/client
  if (urlPath !== '/' && !urlPath.startsWith('/_server')) {
    const filePath = join(__dirname, 'dist', 'client', urlPath);
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        const buf = await readFile(filePath);
        const ext = extname(filePath);
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': urlPath.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        });
        return res.end(buf);
      }
    } catch {
      // File not found, fall through to SSR
    }
  }

  // 2. Build a Web Request from the Node http.IncomingMessage
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'] || `localhost:${PORT}`;
    const url = `${protocol}://${host}${req.url}`;

    // Read body for non-GET/HEAD methods
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }

    const webRequest = new Request(url, {
      method: req.method,
      headers: Object.fromEntries(
        Object.entries(req.headers)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v])
      ),
      body,
      duplex: body ? 'half' : undefined,
    });

    // 3. Call the SSR handler's fetch method
    const webResponse = await ssrHandler.fetch(webRequest, {}, {});

    // 4. Convert the Web Response back to Node http.ServerResponse
    const headers = {};
    webResponse.headers.forEach((value, key) => {
      if (headers[key]) {
        headers[key] = Array.isArray(headers[key])
          ? [...headers[key], value]
          : [headers[key], value];
      } else {
        headers[key] = value;
      }
    });

    res.writeHead(webResponse.status, headers);

    if (webResponse.body) {
      const reader = webResponse.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      await pump();
    } else {
      const text = await webResponse.text();
      res.end(text);
    }
  } catch (err) {
    console.error('SSR handler error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Sutra ERP server ready on port ${PORT}`);
});
