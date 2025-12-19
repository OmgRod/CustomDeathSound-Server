import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { initDB } from "./db";

dotenv.config();

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

  const downloadHandler = (await import("./utils/downloadHandler")).default;
  app.use(downloadHandler);

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "../public")));

  const getSFXbyIDRouter = (await import("./routes/sfx")).default;
  const getTopSFXListRouter = (await import("./routes/getTopSFXlist")).default;
  const getPackByIDRouter = (await import("./routes/pack")).default;
  const getTopPacksListRouter = (await import("./routes/getTopPacksList")).default;
  const uploadPackRouter = (await import("./routes/uploadPack")).default;
  const uploadSFXRouter = (await import("./routes/uploadSFX")).default;
  const usersRouter = (await import("./routes/users")).default;

  app.use("/sfx", getSFXbyIDRouter);
  app.use("/getTopSFXlist", getTopSFXListRouter);
  app.use("/pack", getPackByIDRouter);
  app.use("/getTopPacksList", getTopPacksListRouter);
  app.use("/uploadPack", uploadPackRouter);
  app.use("/uploadSFX", uploadSFXRouter);
  app.use("/users", usersRouter);

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
