import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const PORT = 5001;
const DB_PATH = "./db.json";

// Initialize local DB schema
const initialDb = {
  dataset: null,
  settings: {
    weights: { frequency: 30, segment: 30, sentiment: 20, trend: 20 },
    alertConfig: { sentimentThreshold: 30, volumeThreshold: 5, emailNotifications: false }
  },
  tickets: []
};

// Safe DB loaders
async function getDb() {
  if (!existsSync(DB_PATH)) {
    await writeFile(DB_PATH, JSON.stringify(initialDb, null, 2));
    return initialDb;
  }
  try {
    const data = await readFile(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return initialDb;
  }
}

async function saveDb(db) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

// REST API router
const server = createServer(async (req, res) => {
  // Enforce CORS for local Vite development
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  try {
    // 1. Dataset sync routes
    if (pathname === "/api/dataset" && req.method === "GET") {
      const db = await getDb();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(db.dataset || {}));
      return;
    }

    if (pathname === "/api/dataset" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const db = await getDb();
          db.dataset = JSON.parse(body);
          await saveDb(db);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
        }
      });
      return;
    }

    // 2. Settings sync routes
    if (pathname === "/api/settings" && req.method === "GET") {
      const db = await getDb();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(db.settings || {}));
      return;
    }

    if (pathname === "/api/settings" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const db = await getDb();
          db.settings = JSON.parse(body);
          await saveDb(db);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
        }
      });
      return;
    }


    // Fallback: endpoint not found
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  } catch (error) {
    console.error("Server router error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
});


// Start HTTP listener
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Customer Feedback Analyzer backend active at http://127.0.0.1:${PORT}`);
});
