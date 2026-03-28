import { useLocation } from "wouter";
import { usePhotos } from "@/hooks/use-photos";
import { PhotoCard } from "@/components/PhotoCard";
import { Camera, MapPin, Layers } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: photos, isLoading, error } = usePhotos();

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Sleek App Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Layers className="w-6 h-6 stroke-[2.5]" />
            <h1 className="text-xl font-extrabold tracking-tight">GeoDual</h1>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground bg-muted px-3 py-1.5 rounded-full text-xs font-semibold">
            <MapPin className="w-3.5 h-3.5" />
            <span>Feed</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="w-12 h-12 border-4 border-muted-foreground/20 border-t-primary rounded-full animate-spin mb-4" />
            <p className="font-medium">Loading memories...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive p-6 rounded-2xl text-center border border-destructive/20">
            <p className="font-semibold">Oops! Something went wrong.</p>
            <p className="text-sm mt-1 opacity-80">Could not load the photo feed.</p>
          </div>
        ) : !photos || photos.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
              <Camera className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">No photos yet</h2>
            <p className="text-muted-foreground max-w-xs">
              Capture your first moment. Your environment and your reaction, pinned to the map.
            </p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-8 sm:gap-12">
            {photos.map((photo, i) => (
              <PhotoCard key={photo.id} photo={photo} index={i} />
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center z-40 pointer-events-none">
        <button
          onClick={() => setLocation("/capture")}
          className="pointer-events-auto group hover-elevate shadow-2xl shadow-primary/25 rounded-full"
        >
          <div className="bg-primary text-primary-foreground px-6 py-4 rounded-full flex items-center gap-3 font-semibold text-lg transition-transform duration-200 group-hover:scale-105 active:scale-95">
            <Camera className="w-6 h-6" />
            <span>Capture</span>
          </div>
        </button>
      </div>
    </div>
  );
}
