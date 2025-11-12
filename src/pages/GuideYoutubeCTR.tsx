import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const GuideYoutubeCTR = () => {
  useEffect(() => {
    document.title = "YouTube Thumbnail Best Practices for CTR | Tittoos AI";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Boost CTR with bold thumbnails: subject, contrast, readable text, export tips.";
    if (meta) meta.setAttribute('content', desc);

    const faq = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What size should a YouTube thumbnail be?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Export at 1280×720 (minimum), under 2MB, 16:9 ratio. Keep key details visible at small sizes."
          }
        },
        {
          "@type": "Question",
          "name": "How much text should I use on thumbnails?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Prefer 2–4 strong words. Ensure high contrast, big fonts, and avoid cluttering the frame."
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
          <h1 className="text-4xl md:text-5xl font-bold">YouTube Thumbnail Best Practices for CTR</h1>
          <p className="text-muted-foreground">Design bold, clear thumbnails that get clicks. Focus, contrast, and legibility.</p>
          <div className="flex gap-3">
            <Link to="/poster" className="inline-flex"><Button>YouTube thumbnail maker</Button></Link>
            <a href={`${import.meta.env.BASE_URL}`} className="inline-flex"><Button variant="outline">Text to image generator</Button></a>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Core Principles</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Define a single focal subject; avoid busy backgrounds.</li>
            <li>Use strong contrast and complementary colours to separate subject and text.</li>
            <li>Keep text to 2–4 words, big and readable on mobile.</li>
            <li>Crop tighter than you think; faces and objects should be large.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Design Patterns</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Face + bold word: close-up portrait with high-contrast title on a solid shape.</li>
            <li>Before/After split: two halves with clear difference and one big claim.</li>
            <li>Icon + number: recognizable icon with a short quantifiable hook.</li>
            <li>Brand palette: reuse colours and type for consistency across videos.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Export & QA</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Export 1280×720 JPEG, under 2MB; preview at 10% zoom to simulate mobile.</li>
            <li>Check grayscale preview to ensure contrast works without colour.</li>
            <li>Test multiple variants; small tweaks can lift CTR materially.</li>
          </ul>
        </section>

        <div className="text-sm text-muted-foreground">
          <Link to="/guides/text-to-image-prompts-cinematic-shots" className="underline">Text to image prompts for cinematic shots</Link>
          <span className="mx-2">•</span>
          <Link to="/poster" className="underline">YouTube thumbnail maker</Link>
          <span className="mx-2">•</span>
          <a href={`${import.meta.env.BASE_URL}`} className="underline">Text to image generator</a>
        </div>
      </div>
    </div>
  );
};

export default GuideYoutubeCTR;