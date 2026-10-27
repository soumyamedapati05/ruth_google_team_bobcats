import express from "express";
import { api } from "./routes.js";

// The Express app without listen(), shared by the local server (server/index.ts)
// and the Vercel serverless function (api/index.ts).
export const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/api", api);
