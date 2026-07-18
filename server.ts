import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import JSZip from "jszip";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Helper to recursively read directories
  function addDirectoryToZip(zip: JSZip, dirPath: string, rootDir: string) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const relPath = path.relative(rootDir, fullPath);
      
      // Ignore patterns
      if (
        relPath === "node_modules" ||
        relPath.startsWith("node_modules" + path.sep) ||
        relPath === "dist" ||
        relPath.startsWith("dist" + path.sep) ||
        relPath === ".git" ||
        relPath.startsWith(".git" + path.sep) ||
        file === ".DS_Store" ||
        file === "thumbs.db"
      ) {
        continue;
      }
      
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        addDirectoryToZip(zip, fullPath, rootDir);
      } else {
        const content = fs.readFileSync(fullPath);
        zip.file(relPath.replace(/\\/g, "/"), content);
      }
    }
  }

  // API endpoint to export the codebase as a ZIP
  app.get("/api/export-zip", async (req, res) => {
    try {
      const zip = new JSZip();
      const rootDir = process.cwd();
      addDirectoryToZip(zip, rootDir, rootDir);
      
      const content = await zip.generateAsync({ type: "nodebuffer" });
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=codehub-project.zip");
      res.send(content);
    } catch (error: any) {
      console.error("ZIP Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate ZIP codebase" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware setup for assets and SPA router
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
