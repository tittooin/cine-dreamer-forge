import React from "react";

// Lazy-load transformers to keep initial bundle small
const TextToImageView: React.FC = () => {
  const [prompt, setPrompt] = React.useState("cinematic portrait of a futuristic warrior, dramatic lighting");
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<string>("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setProgress("Loading model (first time may take a while)...");
    try {
      const mod = await import("@xenova/transformers");
      const { pipeline, env } = mod as any;
      // Allow remote models and use wasm CPU backend
      env.allowRemoteModels = true;
      env.backends.onnx.wasm.numThreads = 2; // keep CPU usage reasonable

      setProgress("Initializing text-to-image pipeline...");
      const pipe = await pipeline("text-to-image", "stabilityai/stable-diffusion-2-1");

      setProgress("Generating image (CPU, low steps for speed)...");
      const result = await pipe(prompt, {
        height: 256,
        width: 256,
        guidance_scale: 7.5,
        num_inference_steps: 4,
        negative_prompt: "blurry, low quality, watermark, text",
      });

      // result is a RawImage. Convert to Data URL for display
      const canvas = result.toCanvas();
      const url = canvas.toDataURL("image/png");
      setImageUrl(url);
      setProgress("Done");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Generation failed");
      setProgress("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-neutral-900 text-white">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Text to Image (CPU)</h1>
        <p className="text-sm text-neutral-300 mb-4">
          Runs entirely in your browser on CPU using open-source models (Transformers.js + Stable Diffusion 2.1). First run downloads model files.
        </p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full h-28 p-3 rounded bg-neutral-800 border border-neutral-700 focus:outline-none"
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={generate}
            disabled={busy || !prompt.trim()}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700"
          >
            {busy ? "Generating…" : "Generate"}
          </button>
          {imageUrl && (
            <a
              download="generated.png"
              href={imageUrl}
              className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600"
            >
              Download PNG
            </a>
          )}
        </div>

        {progress && <div className="mt-3 text-xs text-neutral-400">{progress}</div>}
        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}

        <div className="mt-6">
          {imageUrl ? (
            <img src={imageUrl} alt="output" className="rounded border border-neutral-700" />
          ) : (
            <div className="text-neutral-400 text-sm">No image yet. Enter a prompt and click Generate.</div>
          )}
        </div>

        <div className="mt-8 text-xs text-neutral-400">
          Tips: CPU generation is slow. For quicker results, keep steps low and resolution small.
        </div>
      </div>
    </div>
  );
};

export default TextToImageView;