import express from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { app } from "./app.js";
import { load, purgeDemoAccounts, DATA_PATH } from "./store.js";
import { MOCK } from "./llm.js";
import { seedMockData } from "./seed.js";

// Serve the built client in production.
const dist = fileURLToPath(new URL("../dist", import.meta.url));
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(`${dist}/index.html`));
}

let db = load();
purgeDemoAccounts();
if (db.listings.length === 0 && process.env.NO_AUTOSEED !== "1") {
  console.log(`no listings in ${DATA_PATH}; seeding mock data (set NO_AUTOSEED=1 to skip)`);
  await seedMockData();
  db = load();
}
const port = Number(process.env.PORT ?? 3030);
app.listen(port, () => {
  console.log(`myops api on :${port}  listings=${db.listings.length}  data=${DATA_PATH}  llm=${MOCK ? "MOCK (set GEMINI_API_KEY to use Gemini)" : "gemini"}`);
});
