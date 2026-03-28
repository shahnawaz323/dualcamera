import { z } from 'zod';
import { insertPhotoSchema, photos } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  photos: {
    list: {
      method: 'GET' as const,
      path: '/api/photos' as const,
      responses: {
        200: z.array(z.custom<typeof photos.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/photos' as const,
      input: insertPhotoSchema,
      responses: {
        201: z.custom<typeof photos.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    deleteAll: {
      method: 'DELETE' as const,
      path: '/api/photos' as const,
      responses: {
        200: z.object({ message: z.string() }),
      },
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type PhotoInput = z.infer<typeof api.photos.create.input>;
export type PhotoResponse = z.infer<typeof api.photos.create.responses[201]>;
export type PhotosListResponse = z.infer<typeof api.photos.list.responses[200]>;
export type ValidationError = z.infer<typeof errorSchemas.validation>;