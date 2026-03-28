import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PhotoInput, type PhotosListResponse, type PhotoResponse } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw new Error(`Data validation failed for ${label}`);
  }
  return result.data;
}

export function usePhotos() {
  return useQuery({
    queryKey: [api.photos.list.path],
    queryFn: async () => {
      const res = await fetch(api.photos.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch photos');
      const data = await res.json();
      return parseWithLogging(api.photos.list.responses[200], data, "photos.list");
    },
  });
}

export function useCreatePhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: PhotoInput) => {
      // Coerce latitude and longitude explicitly before sending if they are numbers
      // The schema accepts string for numeric, but let's ensure it matches input schema.
      const payload = {
        imageUrl: data.imageUrl,
        latitude: data.latitude ? String(data.latitude) : null,
        longitude: data.longitude ? String(data.longitude) : null,
      };

      const validated = api.photos.create.input.parse(payload);
      
      const res = await fetch(api.photos.create.path, {
        method: api.photos.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const errorData = await res.json();
          // Fallback parsing if backend error format is slightly off
          console.error("Validation error from server:", errorData);
          throw new Error(errorData.message || 'Validation failed');
        }
        throw new Error('Failed to create photo');
      }
      
      const responseData = await res.json();
      return parseWithLogging(api.photos.create.responses[201], responseData, "photos.create");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.photos.list.path] });
    },
  });
}
