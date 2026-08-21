// cPanel Application Manager / Phusion Passenger entry point.
// Build first with `npm run deploy:cpanel`, then restart the application in cPanel.
// CloudLinux/LiteSpeed sometimes runs Passenger in an environment where Prisma
// cannot resolve its generated native engine through the Node virtualenv link.
// Load the generated engine from an application-owned location.
if (process.platform === "linux") {
  const fs = require("fs");
  const path = require("path");
  const engineName = "libquery_engine-debian-openssl-1.0.x.so.node";
  const source = path.join(__dirname, "node_modules", ".prisma", "client", engineName);
  const engineDirectory = path.join(__dirname, "tmp", "prisma-engines");
  const target = path.join(engineDirectory, engineName);

  if (fs.existsSync(source)) {
    fs.mkdirSync(engineDirectory, { recursive: true, mode: 0o700 });
    fs.copyFileSync(source, target);
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = target;
  }
}

require("./.next/standalone/server.js");
