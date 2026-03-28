import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.photos.list.path, async (req, res) => {
    try {
      const allPhotos = await storage.getPhotos();
      res.json(allPhotos);
    } catch (err) {
      console.error("Failed to fetch photos", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.photos.create.path, async (req, res) => {
    try {
      // For string inputs like numeric values in Zod from frontend JSON, they should be fine,
      // but let's extend with coerce if needed. Our schema has numeric("latitude") which Drizzle maps to string usually,
      // and Zod might expect string or number. Let's rely on standard parsing.
      const input = api.photos.create.input.parse(req.body);
      const photo = await storage.createPhoto(input);
      res.status(201).json(photo);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Failed to create photo", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.photos.deleteAll.path, async (req, res) => {
    try {
      await storage.deleteAllPhotos();
      res.json({ message: "All photos deleted" });
    } catch (err) {
      console.error("Failed to delete photos", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}