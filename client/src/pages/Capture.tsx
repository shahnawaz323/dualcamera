import { useLocation } from "wouter";
import { useCreatePhoto } from "@/hooks/use-photos";
import { CameraInterface } from "@/components/CameraInterface";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function CapturePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const createPhotoMutation = useCreatePhoto();

  const handleCaptureComplete = async (imageUrl: string, location: { lat: number | null, lng: number | null }) => {
    try {
      // Delete all previous photos first
      await apiRequest(api.photos.deleteAll.method, api.photos.deleteAll.path);
      
      await createPhotoMutation.mutateAsync({
        imageUrl,
        latitude: location.lat !== null ? String(location.lat) : undefined,
        longitude: location.lng !== null ? String(location.lng) : undefined,
      });
      
      // Invalidate queries to refresh the feed
      queryClient.invalidateQueries({ queryKey: [api.photos.list.path] });
      
      toast({
        title: "Success!",
        description: "Old photos cleared and new photo saved.",
      });
      
      // Navigate back to home feed
      setLocation("/");
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload photo",
        variant: "destructive",
      });
      // Optionally let them retry or just navigate back
      setLocation("/");
    }
  };

  return (
    <CameraInterface 
      onCaptureComplete={handleCaptureComplete}
      isUploading={createPhotoMutation.isPending}
    />
  );
}
