import { type PhotoResponse } from "@shared/routes";
import { MapPin, CalendarClock, Download, Share2 } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PhotoCardProps {
  photo: PhotoResponse;
  index: number;
}

export function PhotoCard({ photo, index }: PhotoCardProps) {
  const { toast } = useToast();
  // Safe date parsing
  const date = photo.createdAt ? new Date(photo.createdAt) : new Date();
  
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = photo.imageUrl;
    link.download = `photo-${format(date, "yyyy-MM-dd-HH-mm")}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        const response = await fetch(photo.imageUrl);
        const blob = await response.blob();
        const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
        
        await navigator.share({
          files: [file],
          title: "Check out my photo!",
          text: `Taken at ${format(date, "MMM d, h:mm a")}`,
        });
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        toast({
          title: "Link Copied",
          description: "Sharing not supported on this browser, link copied to clipboard.",
        });
      }
    } catch (err) {
      console.error("Share failed", err);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="group relative w-full overflow-hidden rounded-3xl bg-card border border-border shadow-sm hover:shadow-xl transition-all duration-500"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-muted relative">
        <img
          src={photo.imageUrl}
          alt={`Taken on ${format(date, "MMM d, yyyy")}`}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
        
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button 
            size="icon" 
            variant="secondary" 
            className="rounded-full shadow-lg opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
          >
            <Share2 className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            variant="secondary" 
            className="rounded-full shadow-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Subtle gradient overlay at the bottom for text readability if the image doesn't have the black box */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-2 text-white">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 opacity-80" />
          <span className="text-sm font-medium drop-shadow-md">
            {format(date, "MMM d, h:mm a")}
          </span>
        </div>
        
        {(photo.latitude && photo.longitude) && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary-foreground opacity-80" />
            <span className="text-sm font-semibold tracking-wide drop-shadow-md">
              {Number(photo.latitude).toFixed(4)}, {Number(photo.longitude).toFixed(4)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
