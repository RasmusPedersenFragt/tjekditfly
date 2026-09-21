// Lokal statisk server til public/ (kun til udvikling). Kør: node serve.cjs   (port 9000, eller PORT=...)
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 9000);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon'
};

http.createServer(function (req, res) {
  var urlPath = decodeURIComponent(req.url.split('?')[0]);
  var filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(filePath, function (err, st) {
    if (!err && st.isDirectory()) {
      if (!urlPath.endsWith('/')) { res.writeHead(301, { Location: urlPath + '/' }); return res.end(); }
      filePath = path.join(filePath, 'index.html');
    }
    fs.readFile(filePath, function (err2, data) {
      if (err2) {
        fs.readFile(path.join(root, '404.html'), function (e3, nf) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(e3 ? '404 – ikke fundet' : nf);
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
}).listen(port, function () {
  console.log('Tjek dit fly kører på http://localhost:' + port);
});
