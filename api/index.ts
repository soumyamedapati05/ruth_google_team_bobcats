// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json).
import { app } from "../server/app.js";
import { load, purgeDemoAccounts } from "../server/store.js";

load();
purgeDemoAccounts();

export default app;
