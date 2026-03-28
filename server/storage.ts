import { db } from "./db";
import { photos, type CreatePhotoRequest, type PhotoResponse } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  getPhotos(): Promise<PhotoResponse[]>;
  createPhoto(photo: CreatePhotoRequest): Promise<PhotoResponse>;
  deleteAllPhotos(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getPhotos(): Promise<PhotoResponse[]> {
    return await db.select().from(photos).orderBy(desc(photos.createdAt));
  }

  async createPhoto(photo: CreatePhotoRequest): Promise<PhotoResponse> {
    const [created] = await db.insert(photos).values(photo).returning();
    return created;
  }

  async deleteAllPhotos(): Promise<void> {
    await db.delete(photos);
  }
}

export const storage = new DatabaseStorage();