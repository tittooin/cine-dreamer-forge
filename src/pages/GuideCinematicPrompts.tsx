import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const GuideCinematicPrompts = () => {
  useEffect(() => {
    document.title = "Text to Image Prompts for Cinematic Shots | Tittoos AI";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Cinematic text-to-image prompts: composition, lighting, lenses, film looks, and examples.";
    if (meta) meta.setAttribute('content', desc);

    const faq = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Best camera settings for cinematic AI renders?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Use prompts referencing focal length (35mm, 50mm), aperture (f/1.8–f/2.8), and sensor characteristics (full-frame look) to get natural depth of field and perspective."
          }
        },
        {
          "@type": "Question",
          "name": "How to get film look in text-to-image?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Add terms like Kodak Portra, CineStill, teal-and-orange grade, 35mm grain, anamorphic bokeh, golden hour, and soft backlight to evoke cinematic film aesthetics."
          }
        }
      ]
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(faq);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold">Text to Image Prompts for Cinematic Shots</h1>
          <p className="text-muted-foreground">Craft realistic frames with camera-aware prompts, lighting, and film aesthetics.</p>
          <div className="flex gap-3">
            <a href={`${import.meta.env.BASE_URL}`} className="inline-flex"><Button variant="outline">Use text to image generator</Button></a>
          <Link to="/youtube-thumbnail" className="inline-flex"><Button>YouTube thumbnail maker</Button></Link>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Core Prompt Building Blocks</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><span className="font-medium">Composition:</span> rule of thirds, leading lines, centered portrait, wide establishing shot.</li>
            <li><span className="font-medium">Lens:</span> 35mm street, 50mm portrait, 85mm shallow DOF, anamorphic cinematic.</li>
            <li><span className="font-medium">Lighting:</span> golden hour, soft backlight, Rembrandt, neon practicals, moody low-key.</li>
            <li><span className="font-medium">Colour & Grade:</span> teal-and-orange, film emulation, desaturated noir, warm tungsten.</li>
            <li><span className="font-medium">Texture:</span> 35mm grain, subtle bloom, halation, slight vignette.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Prompt Templates</h2>
          <div className="space-y-3">
            <p className="font-medium">Cinematic portrait (50mm):</p>
            <p className="bg-muted p-3 rounded">"Cinematic portrait, 50mm lens perspective, shallow depth of field, soft golden hour backlight, subtle film grain, teal-and-orange grade, centered subject, natural skin tones"</p>
            <p className="font-medium">Street scene (35mm):</p>
            <p className="bg-muted p-3 rounded">"City street, 35mm wide shot, leading lines, neon practical lighting, rainy reflections, slight bloom, film emulation, high contrast, moody vibe"</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Workflow Tips</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Start simple; add camera and lighting terms gradually.</li>
            <li>Iterate with variations; adjust focal length and aperture words.</li>
            <li>Use film references sparingly to avoid overprocessing.</li>
            <li>Export larger frames and sharpen slightly for thumbnails.</li>
          </ul>
        </section>

        <div className="text-sm text-muted-foreground">
          <Link to="/guides/youtube-thumbnail-best-practices-ctr" className="underline">YouTube thumbnail best practices for CTR</Link>
          <span className="mx-2">•</span>
          <a href={`${import.meta.env.BASE_URL}`} className="underline">Text to image generator</a>
          <span className="mx-2">•</span>
          <Link to="/youtube-thumbnail" className="underline">YouTube thumbnail maker</Link>
        </div>
      </div>
    </div>
  );
};

export default GuideCinematicPrompts;