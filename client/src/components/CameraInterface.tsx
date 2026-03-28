import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, SwitchCamera, X, MapPin, Loader2, Check, Zap, ZapOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

type CameraState = 
  | "initializing"
  | "ready_back"
  | "capturing_back"
  | "ready_front"
  | "capturing_front"
  | "processing"
  | "done"
  | "error";

interface LocationData {
  lat: number | null;
  lng: number | null;
}

interface CameraInterfaceProps {
  onCaptureComplete: (imageDataUrl: string, location: LocationData) => void;
  isUploading: boolean;
}

export function CameraInterface({ onCaptureComplete, isUploading }: CameraInterfaceProps) {
  const [, setLocationParams] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [cameraState, setCameraState] = useState<CameraState>("initializing");
  const [errorMessage, setErrorMessage] = useState("");
  
  const [backImage, setBackImage] = useState<HTMLImageElement | null>(null);
  const [frontImage, setFrontImage] = useState<HTMLImageElement | null>(null);
  
  const [geoData, setGeoData] = useState<LocationData>({ lat: null, lng: null });
  const [editableLocation, setEditableLocation] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashOn, setFlashOn] = useState(false);

  // Stop active streams
  const stopStream = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const toggleFlash = useCallback(async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    
    try {
      const capabilities = track.getCapabilities() as any;
      if (capabilities.torch) {
        const newFlashState = !flashOn;
        await track.applyConstraints({
          advanced: [{ torch: newFlashState }]
        } as any);
        setFlashOn(newFlashState);
      } else {
        console.warn("Torch not supported on this camera");
      }
    } catch (err) {
      console.error("Error toggling flash:", err);
    }
  }, [flashOn]);

  // Request specific camera
  const startCamera = useCallback(async (facingMode: 'environment' | 'user') => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (!videoRef.current) return;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().then(resolve);
          };
        });
        setCameraState(facingMode === 'environment' ? 'ready_back' : 'ready_front');
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraState('error');
      setErrorMessage("Could not access camera. Please check permissions.");
    }
  }, [stopStream]);

  const fetchLocation = useCallback(async () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          setGeoData({ lat, lng });
          
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`);
            const data = await response.json();
            if (data.address) {
              const { house_number, road, building, suburb, neighbourhood, residential, city, town, village, state, country } = data.address;
              const parts = [];
              if (building || house_number || road) parts.push([building, house_number, road].filter(Boolean).join(" "));
              const area = suburb || neighbourhood || residential;
              if (area) parts.push(area);
              const cityPart = city || town || village;
              if (cityPart) parts.push(cityPart);
              if (state) parts.push(state);
              if (country) parts.push(country);
              setEditableLocation(parts.join(", "));
            }
          } catch (e) {
            console.error("Geocoding failed", e);
            setEditableLocation("Current Location");
          }
        },
        (err) => console.warn("Geolocation error:", err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  // Initial setup: request location and back camera
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!mounted) return;
      fetchLocation();
      await startCamera('environment');
    };

    init();

    return () => {
      mounted = false;
      stopStream();
    };
  }, [startCamera, stopStream]);

  // Helper to extract current frame from video to an Image object
  const captureFrameToImage = useCallback((): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      if (!videoRef.current) return;
      const video = videoRef.current;
      
      // Use higher resolution for capture
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = dataUrl;
    });
  }, []);

  // Main capture flow
  const handlePrimaryCapture = useCallback(async () => {
    if (cameraState !== 'ready_back') return;
    
    setCameraState('capturing_back');
    const bImg = await captureFrameToImage();
    setBackImage(bImg);
    
    // Switch to front camera
    setCameraState('initializing');
    await startCamera('user');
    
    // Start countdown for front capture
    let count = 3;
    setCountdown(count);
    
    const interval = setInterval(async () => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        setCountdown(null);
        setCameraState('capturing_front');
        
        const fImg = await captureFrameToImage();
        setFrontImage(fImg);
        stopStream();
        setCameraState('processing');
      }
    }, 1000);
    
  }, [cameraState, captureFrameToImage, startCamera, stopStream]);

  // Draw final composite image
  const processFinalImage = useCallback(async () => {
    if (!backImage || !frontImage) return;

    // Output dimensions (High resolution)
    const CANVAS_W = 1200;
    const CANVAS_H = 1600;
    
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Use high quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Helper: draw image mimicking object-fit: cover
    const drawCover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
      const imgRatio = img.width / img.height;
      const targetRatio = w / h;
      let drawW = w;
      let drawH = h;
      let drawX = x;
      let drawY = y;

      if (imgRatio > targetRatio) {
        drawW = h * imgRatio;
        drawX = x + (w - drawW) / 2;
      } else {
        drawH = w / imgRatio;
        drawY = y + (h - drawH) / 2;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    };

    // 1. Draw Back Image Full Screen
    ctx.save();
    // Ensure the entire canvas is filled with the back image (no borders)
    drawCover(backImage, 0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();

    // 2. Draw Front Image (PIP) in top left
    const pipW = CANVAS_W * 0.3;
    const pipH = CANVAS_H * 0.3;
    const pipX = 40;
    const pipY = 40;
    const cornerRadius = 40;
    
    // Draw Front Image with rounded corners and black border
    ctx.save();
    
    // Create rounded rectangle path for clipping
    ctx.beginPath();
    ctx.roundRect(pipX, pipY, pipW, pipH, cornerRadius);
    ctx.closePath();
    
    // Draw black border first
    ctx.strokeStyle = "black";
    ctx.lineWidth = 12;
    ctx.stroke();
    
    // Clip for the image
    ctx.clip();
    
    // Mirror the front camera horizontally
    ctx.translate(pipX + pipW / 2, pipY + pipH / 2);
    ctx.scale(-1, 1);
    ctx.translate(-(pipX + pipW / 2), -(pipY + pipH / 2));
    
    // Reverted to previous "better" selfie view (drawCover for focused look)
    drawCover(frontImage, pipX, pipY, pipW, pipH);
    ctx.restore();

    // 3. Draw Geotag Overlay at bottom
    if (geoData.lat !== null && geoData.lng !== null) {
      const barHeight = 240;
      const barY = CANVAS_H - barHeight - 40;
      const margin = 40;
      const innerWidth = CANVAS_W - (margin * 2);
      
      // Black background rounded box for the data
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      const boxRadius = 30;
      ctx.beginPath();
      ctx.roundRect(margin, barY, innerWidth, barHeight, boxRadius);
      ctx.closePath();
      ctx.fill();

      // Text setup
      ctx.fillStyle = "white";
      ctx.textAlign = "left";

      const textX = margin + 40;
      const maxTextWidth = innerWidth - 80;
      
      // Fetch city/road name
      const locationName = editableLocation || "CURRENT LOCATION";

      // Helper to draw text with auto-scaling
      const fillTextAuto = (text: string, x: number, y: number, maxWidth: number, baseSize: number, weight: string) => {
        let fontSize = baseSize;
        ctx.font = `${weight} ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        while (ctx.measureText(text).width > maxWidth && fontSize > 16) {
          fontSize -= 2;
          ctx.font = `${weight} ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        }
        ctx.fillText(text, x, y);
      };

      // Location Name
      fillTextAuto(locationName, textX, barY + 70, maxTextWidth, 42, "700");

      // Coordinates
      const latText = `Lat ${geoData.lat.toFixed(6)}° Long ${geoData.lng.toFixed(6)}°`;
      fillTextAuto(latText, textX, barY + 130, maxTextWidth, 32, "500");
      
      // Date/Time
      const now = new Date();
      const timeStr = now.toLocaleString("en-US", { 
        weekday: "long", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true 
      });
      fillTextAuto(timeStr, textX, barY + 190, maxTextWidth, 32, "500");
    }

    // Extract Base64 (High quality)
    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCameraState('done');
    onCaptureComplete(finalDataUrl, geoData);

  }, [backImage, frontImage, geoData, editableLocation, onCaptureComplete]);

  // Trigger processing once both images are acquired
  useEffect(() => {
    if (cameraState === 'processing') {
      processFinalImage();
    }
  }, [cameraState, processFinalImage]);


  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden flex flex-col">
      {/* Header controls */}
      <div className="absolute top-0 inset-x-0 z-20 p-4 sm:p-6 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
        <button 
          onClick={() => setLocationParams("/")}
          className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {cameraState === 'ready_back' && (
            <button 
              onClick={toggleFlash}
              className={`w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center transition-colors ${
                flashOn ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {flashOn ? <Zap className="w-6 h-6 fill-current" /> : <ZapOff className="w-6 h-6" />}
            </button>
          )}
          <button 
            onClick={fetchLocation}
            className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white text-sm font-medium flex items-center gap-2 hover:bg-white/20 transition-colors"
          >
            <MapPin className={`w-4 h-4 ${geoData.lat ? 'text-green-400' : 'opacity-50'}`} />
            Update Location
          </button>
          <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white text-sm font-medium">
            {cameraState === 'ready_back' ? 'Environment' : cameraState.includes('front') ? 'Selfie' : 'Processing'}
          </div>
        </div>
      </div>

      {/* Main Viewfinder Area */}
      <div className="relative flex-1 bg-zinc-900 overflow-hidden rounded-b-[40px] sm:rounded-none">
        
        {/* Active Video Stream */}
        <video 
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            cameraState === 'error' ? 'opacity-0' : 'opacity-100'
          }`}
          style={cameraState.includes('front') ? { transform: 'scaleX(-1)' } : {}}
        />

        {/* Captured Back Image (Frozen) while taking front */}
        <AnimatePresence>
          {backImage && (cameraState === 'ready_front' || cameraState === 'capturing_front' || cameraState === 'processing') && (
            <motion.img
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={backImage.src}
              className="absolute inset-0 w-full h-full object-cover z-0"
              alt="Back capture"
            />
          )}
        </AnimatePresence>

        {/* PIP Viewfinder for front camera */}
        <AnimatePresence>
          {(cameraState === 'ready_front' || cameraState === 'capturing_front') && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="absolute top-20 left-6 w-[28%] aspect-[3/4] rounded-2xl overflow-hidden border-4 border-white shadow-2xl z-10 bg-black"
            >
              {/* Note: The video element is actually full screen, we are just obscuring the back image. 
                  To do a true PIP, we'd need two video elements.
                  Since we freeze the back image above, the live video element now shows the front camera full screen.
                  Wait, if video is full screen, the front camera will be full screen.
                  Let's fix the CSS so the video element ITSELF becomes the PIP!
              */}
              <style>{`
                video {
                  position: absolute !important;
                  top: 5rem !important;
                  left: 1.5rem !important;
                  width: 28% !important;
                  height: auto !important;
                  aspect-ratio: 3/4 !important;
                  border-radius: 1rem !important;
                  border: 4px solid white !important;
                  z-index: 10 !important;
                  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5) !important;
                }
              `}</style>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlays */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          {cameraState === 'initializing' && (
            <Loader2 className="w-10 h-10 text-white animate-spin drop-shadow-md" />
          )}
          
          {countdown !== null && (
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="text-8xl font-black text-white text-glow"
            >
              {countdown}
            </motion.div>
          )}

          {(cameraState === 'processing' || isUploading) && (
            <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-black/40 backdrop-blur-xl">
              {isUploading ? <Check className="w-10 h-10 text-green-400" /> : <Loader2 className="w-10 h-10 text-white animate-spin" />}
              <p className="text-white font-medium text-lg">
                {isUploading ? "Uploading..." : "Processing magic..."}
              </p>
            </div>
          )}

          {cameraState === 'error' && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-white font-medium mb-2">Camera Unavailable</p>
              <p className="text-white/60 text-sm">{errorMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Location Editor */}
      <AnimatePresence>
        {cameraState === 'ready_back' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-40 inset-x-0 z-30 px-6"
          >
            <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
              <label className="text-white/60 text-xs font-bold uppercase tracking-wider mb-2 block">Location Tag</label>
              <textarea
                value={editableLocation}
                onChange={(e) => setEditableLocation(e.target.value)}
                placeholder="Click 'Update Location' or type here..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30 transition-colors resize-none h-20"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Area */}
      <div className="h-40 bg-black flex items-center justify-center relative pb-6 z-20">
        <button
          onClick={handlePrimaryCapture}
          disabled={cameraState !== 'ready_back'}
          className={`relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group transition-all duration-300
            ${cameraState !== 'ready_back' ? 'opacity-50 scale-90 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
          `}
        >
          <div className="w-16 h-16 rounded-full bg-white transition-all duration-300 group-hover:w-14 group-hover:h-14" />
        </button>
      </div>
    </div>
  );
}
