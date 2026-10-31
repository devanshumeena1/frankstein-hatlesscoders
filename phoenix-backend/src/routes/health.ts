import mongoose from "mongoose";
import { Router } from "express";
import { getSettings } from "../config";

export const healthRouter = Router();

healthRouter.get("/api/health", (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  const status = dbOk ? 200 : 503;
  res.status(status).json({ status: dbOk ? "ok" : "error", version: getSettings().APP_VERSION, db: dbOk ? "ok" : "error" });
});
