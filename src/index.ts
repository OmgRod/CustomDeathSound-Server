import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { initDB } from "./db";

async function ensureDirectoriesAndFiles() {
  const publicDir = path.join(__dirname, "../public");
  const soundsDir = path.join(publicDir, "sounds");
  const dbDir = path.join(__dirname, "../db");
  const sfxJsonPath = path.join(dbDir, "sfx.json");
  const packsJsonPath = path.join(dbDir, "packs.json");

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

  return { publicDir, soundsDir, dbDir, sfxJsonPath, packsJsonPath };
}

async function startServer() {
  await ensureDirectoriesAndFiles();
  await initDB();

  const app = express();
  const port = 3000;

  const downloadHandler = (await import("./routes/downloadHandler")).default;
  app.use(downloadHandler);

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "../public")));

  const uploadSFXRouter = (await import("./routes/uploadSFX")).default;
  const getSFXbyIDRouter = (await import("./routes/getSFXbyID")).default;
  const getSFXlistRouter = (await import("./routes/getSFXlist")).default;
  const uploadPackRouter = (await import("./routes/uploadPack")).default;
  const getPackByIDRouter = (await import("./routes/getPackByID")).default;
  const getPackslistRouter = (await import("./routes/getPacksList")).default;

  app.use("/uploadSFX", uploadSFXRouter);
  app.use("/getSFXbyID", getSFXbyIDRouter);
  app.use("/getSFXlist", getSFXlistRouter);
  app.use("/uploadPack", uploadPackRouter);
  app.use("/getPackByID", getPackByIDRouter);
  app.use("/getPacksList", getPackslistRouter);

  app.get("/", (req: Request, res: Response) => {
    res.send("Server is running!");
  });

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
