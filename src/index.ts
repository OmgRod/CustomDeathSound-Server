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

  return { publicDir, soundsDir, dbDir, sfxJsonPath, packsJsonPath, usersJsonPath };
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

  app.use("/sfx", getSFXbyIDRouter);
  app.use("/getTopSFXlist", getTopSFXListRouter);
  app.use("/pack", getPackByIDRouter);
  app.use("/getTopPacksList", getTopPacksListRouter);
  app.use("/uploadPack", uploadPackRouter);
  app.use("/uploadSFX", uploadSFXRouter);
  app.use("/users", usersRouter);
  app.use("/auth", authRouter);

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
