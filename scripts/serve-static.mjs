import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("dist");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function resolvePath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const normalized = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(join(root, normalized));
  if (!candidate.startsWith(root)) return join(root, "index.html");
  return candidate;
}

const server = createServer(async (request, response) => {
  let filePath = resolvePath(request.url || "/");

  if (!existsSync(filePath) || (await stat(filePath)).isDirectory()) {
    filePath = join(root, "index.html");
  }

  response.setHeader("Content-Type", mimeTypes[extname(filePath)] || "application/octet-stream");
  createReadStream(filePath)
    .on("error", () => {
      response.statusCode = 500;
      response.end("Unable to read static asset.");
    })
    .pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Customer Feedback Analyzer ready at http://127.0.0.1:${port}`);
});
