/**
 * Custom Next server.
 *
 * Next is only half the app: Socket.io needs to own the same HTTP server so
 * WebSocket upgrades reach it. `next start` gives no way in, which is why this
 * file exists and why production runs `tsx server.ts` instead.
 */
import { createServer } from "node:http";
import next from "next";
import { attachSocketServer } from "./src/server/socket";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3004);
// Nginx is the only thing that should reach this process.
const hostname = process.env.HOST ?? "127.0.0.1";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const server = createServer((req, res) => {
    // Answered here rather than by a Next route, so a green /healthz proves the
    // socket process is alive and not merely that Next can render.
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
      return;
    }
    handle(req, res);
  });

  attachSocketServer(server);

  server.listen(port, hostname, () => {
    console.log(`guess-music listening on http://${hostname}:${port}`);
  });
}

main().catch((err) => {
  console.error("failed to start", err);
  process.exit(1);
});
