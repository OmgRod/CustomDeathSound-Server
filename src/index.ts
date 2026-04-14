import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { initDB } from "./db";

dotenv.config();

function isSensitivePath(pathname: string, isProduction: boolean) {
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    decodedPath = pathname;
  }

  if (decodedPath.includes("..")) {
    return true;
  }

  if (!isProduction && /^\/(src|node_modules)(?:\/|$)/i.test(decodedPath)) {
    return false;
  }

  return /^\/(\.env(?:\.|$)|\.git(?:\/|$)|db(?:\/|$)|src(?:\/|$)|scripts(?:\/|$)|node_modules(?:\/|$)|package(-lock)?\.json$|tsconfig(?:\..+)?\.json$)/i.test(decodedPath);
}

async function ensureDirectoriesAndFiles() {
  const publicDir = path.join(__dirname, "../public");
  const soundsDir = path.join(publicDir, "sounds");
  const dbDir = path.join(__dirname, "../db");
  const sfxJsonPath = path.join(dbDir, "sfx.json");
  const packsJsonPath = path.join(dbDir, "packs.json");
  const usersJsonPath = path.join(dbDir, "users.json");
  const tagAuditJsonPath = path.join(dbDir, "tagAudit.json");

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir);
  }
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
  }
  if (!fs.existsSync(sfxJsonPath)) {
    fs.writeFileSync(sfxJsonPath, JSON.stringify({ sfx: [] }, null, 2));
  }
  if (!fs.existsSync(packsJsonPath)) {
    fs.writeFileSync(packsJsonPath, JSON.stringify({ packs: [] }, null, 2));
  }
  if (!fs.existsSync(usersJsonPath)) {
    fs.writeFileSync(usersJsonPath, JSON.stringify({ users: [] }, null, 2));
  }
  if (!fs.existsSync(tagAuditJsonPath)) {
    fs.writeFileSync(tagAuditJsonPath, JSON.stringify({ entries: [] }, null, 2));
  }

  return { publicDir, soundsDir, dbDir, sfxJsonPath, packsJsonPath, usersJsonPath, tagAuditJsonPath };
}

async function startServer() {
  await ensureDirectoriesAndFiles();
  await initDB();

  const app = express();
  const port = process.env["PORT"] || 3000;
  const isProduction = process.env["NODE_ENV"] === "production" || /[\\/]build$/.test(__dirname);
  const rootDir = path.join(__dirname, "..");
  const distDir = path.join(rootDir, "dist");

  app.disable("x-powered-by");

  app.use((req: Request, res: Response, next) => {
    if (isSensitivePath(req.path, isProduction)) {
      res.status(404).send("Not found");
      return;
    }

    next();
  });

  app.use(express.json());

  const staticOptions = {
    dotfiles: "deny" as const,
    fallthrough: true,
    index: false,
    redirect: false,
  };

  app.use(express.static(path.join(__dirname, "../public"), staticOptions));

  app.get('/verify', (req, res) => {
    const isProduction = process.env["NODE_ENV"] === "production" || /[\\/]build$/.test(__dirname);
    const scriptSrc = isProduction ? "/frontend/verify.js" : "/src/frontend/verify.ts";
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Mod Verification</title>
          <meta name="description" content="Verify your mod login." />
          <script type="module" src="${scriptSrc}"></script>
          <style>
            html, body {
              background: linear-gradient(180deg, #171a20, #111318) !important;
              color: #e9edf2 !important;
              min-height: 100vh;
              margin: 0;
            }
            .verify-shell {
              max-width: 480px;
              margin: 60px auto 0 auto;
              background: #181a20;
              border-radius: 12px;
              box-shadow: 0 2px 16px #0008;
              padding: 2.5rem 2rem 2rem 2rem;
              color: #fff;
              font-family: 'Segoe UI', 'Arial', sans-serif;
            }
            .verify-shell h2 {
              font-size: 2rem;
              margin-bottom: 1.1rem;
              font-weight: 700;
              letter-spacing: 0.01em;
              text-shadow: 0 2px 8px #000a;
            }
            .verify-shell p {
              margin: 0.5rem 0 1.2rem 0;
              font-size: 1.1rem;
              color: #e0e0e0;
            }
            .verify-code-box {
              background: #23263a;
              color: #00eaff;
              font-family: 'JetBrains Mono', 'Fira Mono', 'Consolas', monospace;
              font-size: 1.15rem;
              padding: 1.1rem 1.2rem;
              border-radius: 8px;
              margin: 0.5rem 0 1.2rem 0;
              word-break: break-all;
              cursor: pointer;
              border: 2px solid #00eaff44;
              transition: background 0.15s, border 0.15s;
              user-select: all;
              text-align: center;
              position: relative;
            }
            .verify-code-box.copied {
              background: #1e2e1e;
              color: #7fff7f;
              border-color: #7fff7f99;
            }
            .verify-copy-hint {
              font-size: 0.95rem;
              color: #aaa;
              margin-bottom: 0.5rem;
              text-align: center;
            }
            .verify-shell small {
              color: #888;
              font-size: 0.95rem;
            }
            .verify-shell button {
              background: #00eaff;
              color: #181a20;
              border: none;
              border-radius: 6px;
              padding: 0.7rem 1.3rem;
              font-size: 1.1rem;
              font-weight: 600;
              cursor: pointer;
              margin-top: 1.2rem;
              transition: background 0.15s;
            }
            .verify-shell button:hover {
              background: #00b3c6;
            }
          </style>
        </head>
        <body>
          <div id="app"></div>
        </body>
      </html>
    `);
  });

  let viteDevServer: import("vite").ViteDevServer | undefined;
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    viteDevServer = await createViteServer({
      root: rootDir,
      appType: "custom",
      server: {
        middlewareMode: true,
        fs: {
          strict: true,
          deny: [".env", ".env.*", "**/.git/**", "**/db/**", "**/scripts/**"],
        },
      },
    });

    app.use(viteDevServer.middlewares);
  } else {
    app.use(express.static(distDir, staticOptions));
  }

  const getSFXbyIDRouter = (await import("./routes/sfx")).default;
  const getTopSFXListRouter = (await import("./routes/getTopSFXlist")).default;
  const getPackByIDRouter = (await import("./routes/pack")).default;
  const getTopPacksListRouter = (await import("./routes/getTopPacksList")).default;
  const uploadPackRouter = (await import("./routes/uploadPack")).default;
  const uploadSFXRouter = (await import("./routes/uploadSFX")).default;
  const usersRouter = (await import("./routes/users")).default;
  const authRouter = (await import("./routes/auth")).default;
  const modVerifyRouter = (await import("./routes/modverify")).default;

  app.use("/sfx", getSFXbyIDRouter);
  app.use("/getTopSFXlist", getTopSFXListRouter);
  app.use("/pack", getPackByIDRouter);
  app.use("/getTopPacksList", getTopPacksListRouter);
  app.use("/uploadPack", uploadPackRouter);
  app.use("/uploadSFX", uploadSFXRouter);
  app.use("/users", usersRouter);
  app.use("/auth", authRouter);
  app.use("/mod", modVerifyRouter);

  const serveFrontend = async (req: Request, res: Response) => {
    try {
      const templatePath = isProduction
        ? path.join(distDir, "index.html")
        : path.join(rootDir, "index.html");
      let template = fs.readFileSync(templatePath, "utf-8");

      if (viteDevServer) {
        template = await viteDevServer.transformIndexHtml(req.originalUrl, template);
      }

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch {
      res.status(500).send("Failed to load frontend");
    }
  };

  app.get(["/", "/app"], serveFrontend);

  app.use(async (req: Request, res: Response, next) => {
    if (req.method !== "GET") {
      return next();
    }

    if (req.path.startsWith('/@vite') || req.path.startsWith('/@id') || req.path.startsWith('/@fs')) {
      return next();
    }

    if (req.path.startsWith('/src/') || req.path.startsWith('/node_modules/')) {
      return next();
    }

    if (path.extname(req.path)) {
      return next();
    }

    const acceptsHtml = req.headers.accept?.includes('text/html');
    if (!acceptsHtml) {
      return next();
    }

    const apiPrefixes = ["/auth", "/upload", "/getTop", "/users", "/pack", "/sfx", "/sounds"];
    if (apiPrefixes.some(prefix => req.path.startsWith(prefix))) {
      return next();
    }

    return serveFrontend(req, res);
  });

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
