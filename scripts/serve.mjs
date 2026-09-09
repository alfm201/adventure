import http from "node:http";
import { stat, realpath } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, extname, sep } from "node:path";
const root = await realpath(resolve(import.meta.dirname, ".."));
const port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".md": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".gz": "application/gzip",
};
const server = http.createServer(async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    let path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (path.startsWith("/tests/reference/production/img/"))
      path = path.replace(
        "/tests/reference/production/img/",
        "/public/assets/",
      );
    let file = resolve(root, "." + path);
    if (file !== root && !file.startsWith(root + sep))
      throw Error("Outside workspace");
    if ((await stat(file)).isDirectory()) {
      if (!path.endsWith("/")) {
        res.writeHead(302, { Location: path + "/" + new URL(req.url, "http://localhost").search });
        res.end(); return;
      }
      file = resolve(file, "index.html");
    }
    file = await realpath(file);
    if (!file.startsWith(root + sep)) throw Error("Outside workspace");
    const info = await stat(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") res.end();
    else {
      const stream = createReadStream(file);
      stream.on("error", () => res.destroy());
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    }
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Adventure v2: http://127.0.0.1:${port}`),
);
