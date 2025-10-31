import React from "react";

const ImageToVideo: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [duration, setDuration] = React.useState(6);
  const [fps, setFps] = React.useState(30);
  const [mode, setMode] = React.useState<"zoom_in"|"zoom_out"|"pan_left"|"pan_right"|"pan_up"|"pan_down">("zoom_in");
  const [overlay, setOverlay] = React.useState("");
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<string>("");
  const [audioFile, setAudioFile] = React.useState<File | null>(null);

  const loadImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const drawFrame = (ctx: CanvasRenderingContext2D, t: number, W: number, H: number) => {
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "#111";
    ctx.fillRect(0,0,W,H);
    if (img) {
      const baseScale = Math.max(W / img.width, H / img.height);
      let tx = 0, ty = 0, scale = baseScale;
      const amt = t; // 0..1
      switch (mode) {
        case "zoom_in": scale = baseScale * (1 + 0.1 * amt); break;
        case "zoom_out": scale = baseScale * (1 - 0.1 * amt); break;
        case "pan_left": tx = -0.1 * amt * W; break;
        case "pan_right": tx = 0.1 * amt * W; break;
        case "pan_up": ty = -0.1 * amt * H; break;
        case "pan_down": ty = 0.1 * amt * H; break;
      }
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const x = (W - drawW)/2 + tx;
      const y = (H - drawH)/2 + ty;
      ctx.drawImage(img, x, y, drawW, drawH);
    }
    if (overlay) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, H-60, W, 60);
      ctx.fillStyle = "#fff";
      ctx.font = "20px Inter, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(overlay, W/2, H-25);
    }
  };

  const startRender = async () => {
    setBusy(true);
    setProgress("Preparing recorder...");
    try {
      const canvas = canvasRef.current!;
      const W = 1280, H = 720;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      // capture stream from canvas
      const stream = canvas.captureStream(fps);

      // Optional: add audio track from uploaded file
      if (audioFile) {
        const audioUrl = URL.createObjectURL(audioFile);
        const audioEl = new Audio(audioUrl);
        audioEl.crossOrigin = "anonymous";
        const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = ac.createMediaElementSource(audioEl);
        const dest = ac.createMediaStreamDestination();
        src.connect(dest);
        src.connect(ac.destination);
        const track = dest.stream.getAudioTracks()[0];
        if (track) stream.addTrack(track);
        await audioEl.play();
      }

      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      const totalFrames = Math.ceil(duration * fps);
      let frame = 0;
      setProgress("Rendering frames...");

      const loop = () => {
        const t = Math.min(1, frame / totalFrames);
        drawFrame(ctx!, t, W, H);
        frame++;
        if (frame <= totalFrames) {
          requestAnimationFrame(loop);
        } else {
          rec.stop();
        }
      };

      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setProgress("Done");
        setBusy(false);
      };

      rec.start();
      loop();
    } catch (e: any) {
      console.error(e);
      setProgress("");
      alert(e?.message || "Failed to render video");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-neutral-900 text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Image to Video (CPU)</h1>
        <p className="text-sm text-neutral-300 mb-4">Ken Burns-style animation on an uploaded image, exported to WebM using your CPU.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm">Upload Image</label>
            <input type="file" accept="image/*" onChange={(e)=>{const f=e.target.files?.[0]; if (f) loadImage(f);}} className="mt-2" />
          </div>
          <div>
            <label className="text-sm">Optional Audio</label>
            <input type="file" accept="audio/*" onChange={(e)=>setAudioFile(e.target.files?.[0]||null)} className="mt-2" />
          </div>
          <div>
            <label className="text-sm">Overlay Text</label>
            <input value={overlay} onChange={(e)=>setOverlay(e.target.value)} className="mt-2 w-full p-2 rounded bg-neutral-800 border border-neutral-700" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-sm">Duration (s)</label>
            <input type="number" min={1} max={30} value={duration} onChange={(e)=>setDuration(parseInt(e.target.value||"6"))} className="mt-2 w-full p-2 rounded bg-neutral-800 border border-neutral-700" />
          </div>
          <div>
            <label className="text-sm">FPS</label>
            <input type="number" min={15} max={60} value={fps} onChange={(e)=>setFps(parseInt(e.target.value||"30"))} className="mt-2 w-full p-2 rounded bg-neutral-800 border border-neutral-700" />
          </div>
          <div>
            <label className="text-sm">Animation</label>
            <select value={mode} onChange={(e)=>setMode(e.target.value as any)} className="mt-2 w-full p-2 rounded bg-neutral-800 border border-neutral-700">
              <option value="zoom_in">Zoom In</option>
              <option value="zoom_out">Zoom Out</option>
              <option value="pan_left">Pan Left</option>
              <option value="pan_right">Pan Right</option>
              <option value="pan_up">Pan Up</option>
              <option value="pan_down">Pan Down</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={startRender} disabled={busy || !img} className="w-full px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700">{busy?"Rendering…":"Render Video"}</button>
          </div>
        </div>

        <canvas ref={canvasRef} className="w-full bg-black rounded border border-neutral-700" />
        {progress && <div className="mt-2 text-xs text-neutral-400">{progress}</div>}

        {videoUrl && (
          <div className="mt-4">
            <video src={videoUrl} controls className="w-full rounded border border-neutral-700" />
            <div className="mt-2 flex gap-3">
              <a download="image-to-video.webm" href={videoUrl} className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600">Download WebM</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageToVideo;