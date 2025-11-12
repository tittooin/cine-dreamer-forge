import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";

const YoutubeThumbnail = () => {
  useEffect(() => {
    document.title = "YouTube Thumbnail Maker – Free AI Thumbnail Generator | Tittoos AI";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Create eye-catching YouTube thumbnails with AI. Bold fonts, cinematic effects, and pro templates that boost CTR.";
    if (meta) meta.setAttribute('content', desc);
  }, []);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': [
      {
        '@type': 'Question',
        'name': 'How do I make a YouTube thumbnail that gets clicks?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Use bold titles, high contrast colors, and a clear focal subject. Our thumbnail maker adds cinematic effects and outlines to boost CTR.'
        }
      },
      {
        '@type': 'Question',
        'name': 'What size are YouTube thumbnails?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': '1280×720 with a minimum width of 640 pixels (16:9). We export in the recommended size.'
        }
      },
      {
        '@type': 'Question',
        'name': 'Can I add glow text and stickers?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Yes. Add glow text, emoji stickers, borders, and effects directly in the editor.'
        }
      }
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold">YouTube Thumbnail Maker</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Make thumbnails that pop. Combine AI images, bold fonts, glow text, and cinematic effects to boost your click‑through rate.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/poster" className="inline-flex"><Button size="lg">Open Editor</Button></Link>
            <a href={`${import.meta.env.BASE_URL}`} className="inline-flex"><Button variant="outline" size="lg">Generate Images</Button></a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5 space-y-2">
            <div className="text-lg font-semibold">Bold Titles</div>
            <div className="text-sm text-muted-foreground">Impact and Bebas presets with outline, shadow, and glow for readable titles.</div>
          </Card>
          <Card className="p-5 space-y-2">
            <div className="text-lg font-semibold">Cinematic Effects</div>
            <div className="text-sm text-muted-foreground">Neon glow, vignette, rays, and color grading to draw attention.</div>
          </Card>
          <Card className="p-5 space-y-2">
            <div className="text-lg font-semibold">Frames & Stickers</div>
            <div className="text-sm text-muted-foreground">Borders, rounded frames, filmstrip styles, and emoji stickers built‑in.</div>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold">Best Practices</h2>
          <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
            <li>Use a single subject with clean background and strong contrast.</li>
            <li>Keep text short: 3–5 words that match your title.</li>
            <li>Stick to your brand colors and consistent style.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold">FAQs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4"><div className="font-medium">How do I make thumbnails that get clicks?</div><div className="text-sm text-muted-foreground">Use bold titles, high contrast, and a clear focal subject. Our editor helps you apply glow text, borders, and cinematic grading.</div></Card>
            <Card className="p-4"><div className="font-medium">What size should thumbnails be?</div><div className="text-sm text-muted-foreground">1280×720 (16:9). We export in the recommended size so you don’t worry about dimensions.</div></Card>
            <Card className="p-4"><div className="font-medium">Can I combine AI images and text?</div><div className="text-sm text-muted-foreground">Yes. Generate with AI on the home page, then compose text and effects in the Poster editor.</div></Card>
            <Card className="p-4"><div className="font-medium">Is it free?</div><div className="text-sm text-muted-foreground">You can try with low‑cost credits. We keep it affordable for creators.</div></Card>
          </div>
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </div>
  );
};

export default YoutubeThumbnail;