/**
 * Custom Next.js server
 *
 * Wraps the standard Next.js request handler with a UDP mesh discovery
 * daemon so devices on the same local network find each other automatically.
 *
 * Usage (automatically via `npm run dev` / `npm start`):
 *   The package.json scripts are updated to use this file via tsx/node.
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initMeshDiscovery } from "./src/lib/mesh/discovery";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOSTNAME ?? "0.0.0.0"; // listen on all interfaces for LAN access

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    void handle(req, res, parsedUrl);
  }).listen(port, hostname, () => {
    console.log(`> GroundTruth running on http://${hostname}:${port}`);
    console.log(`> LAN URL: http://${getLANAddress()}:${port}`);

    // Start UDP mesh discovery alongside the HTTP server
    initMeshDiscovery(port);
  });
});

function getLANAddress(): string {
  const { networkInterfaces } = require("os") as typeof import("os");
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of (ifaces[name] ?? [])) {
      if (!iface.internal && iface.family === "IPv4") return iface.address;
    }
  }
  return "localhost";
}
