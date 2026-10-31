import type { Request, Response } from "express";
import { createApp } from "../src/app";
import { getSettings } from "../src/config";
import { connectDb } from "../src/db";
import mongoose from "mongoose";

const app = createApp();
let connected = false;

export default async function handler(req: Request, res: Response) {
  if (!connected || mongoose.connection.readyState !== 1) {
    await connectDb(getSettings().MONGODB_URI);
    connected = true;
  }
  return app(req, res);
}
