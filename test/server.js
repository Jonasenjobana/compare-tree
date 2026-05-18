import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4324;
const HOST = '192.168.1.159';
const TARGET = 'http://172.100.100.223:8080';

// ========================
// MIME 映射
// ========================
const MIME = {
    '.html': 'text/html;charset=utf-8',
    '.js'  : 'text/javascript;charset=utf-8',
    '.css' : 'text/css;charset=utf-8',
    '.png' : 'image/png',
    '.jpg' : 'image/jpeg',
    '.svg' : 'image/svg+xml',
};

// ========================
// 服务静态文件
// ========================
function serveStatic(req, res) {
    let filePath = req.url === '/' ? '/compare.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain;charset=utf-8' });
            res.end('404 Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

// ========================
// 代理 API
// ========================
function proxyAPI(req, res) {
    const url = TARGET + '/v1/chat/completions';

    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
        body = Buffer.concat(body);

        const urlObj = new URL(url);
        const mod = urlObj.protocol === 'https:' ? https : http;
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        };

        const proxyReq = mod.request(options, upstreamRes => {
            const headers = { 'Content-Type': upstreamRes.headers['content-type'] || 'application/json' };
            res.writeHead(upstreamRes.statusCode, headers);
            upstreamRes.pipe(res);
        });

        proxyReq.on('error', err => {
            res.writeHead(502, { 'Content-Type': 'text/plain;charset=utf-8' });
            res.end('代理请求失败: ' + err.message);
        });

        proxyReq.end(body);
    });
}

// ========================
// 启动
// ========================
const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        proxyAPI(req, res);
    } else {
        serveStatic(req, res);
    }
});

server.listen(PORT, HOST, () => {
    console.log(`🚢 船舶比对服务已启动: http://${HOST}:${PORT}`);
});
