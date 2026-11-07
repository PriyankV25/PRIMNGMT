
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Directories and files that must never be publicly served.
const BLOCKED_PATHS = [
  '.env',
  '.git',
  '.github',
  'node_modules',
  'backend',
  'supabase',
  'package.json',
  'package-lock.json',
  'server.js',
  'README.md'
];

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('405 Method Not Allowed');
    return;
  }

  let pathname;

  try {
    pathname = decodeURIComponent(
      new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname
    );
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('400 Bad Request');
    return;
  }

  if (pathname.includes('\0')) {
    res.writeHead(400);
    res.end('400 Bad Request');
    return;
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const normalizedPath = path.normalize(pathname).replace(/^([/\\])+/, '');
  const filePath = path.resolve(__dirname, normalizedPath);
  const relativePath = path.relative(__dirname, filePath);

  // Prevent requests from escaping the project directory.
  if (
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Block private files and backend-only directories.
  const pathSegments = relativePath.split(path.sep);

  const isBlocked = pathSegments.some(segment =>
    BLOCKED_PATHS.includes(segment) ||
    segment.startsWith('.env')
  );

  if (isBlocked) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA fallback for routes without file extensions.
      if (!path.extname(pathname)) {
        const indexPath = path.join(__dirname, 'index.html');

        fs.readFile(indexPath, (indexErr, content) => {
          if (indexErr) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8'
          });

          res.end(req.method === 'HEAD' ? undefined : content);
        });

        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType
      });

      res.end(req.method === 'HEAD' ? undefined : content);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log('\n======================================================');
  console.log('PRIMNGMT is running!');
  console.log(`Local Dashboard: http://localhost:${PORT}`);
  console.log(`Server Host: ${HOST}`);
  console.log('======================================================\n');
});

server.on('error', error => {
  console.error('[Server Error]:', error);
  process.exit(1);
});
