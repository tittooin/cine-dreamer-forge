import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Guides = () => {
  useEffect(() => {
    document.title = "Guides – Text to Image & YouTube Thumbnail Tips | Tittoos AI";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Learn cinematic text-to-image prompts and YouTube thumbnail best practices to improve CTR.";
    if (meta) meta.setAttribute('content', desc);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold">Guides for Creators</h1>
          <p className="text-muted-foreground">Prompts, tips, and workflows to get better results.</p>
          <div className="flex gap-3 justify-center">
            <a href={`${import.meta.env.BASE_URL}`} className="inline-flex"><Button variant="outline">Text to image generator</Button></a>
            <Link to="/youtube-thumbnail" className="inline-flex"><Button>YouTube thumbnail maker</Button></Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-5 space-y-2">
            <div className="text-xl font-semibold">Text to Image Prompts for Cinematic Shots</div>
            <div className="text-sm text-muted-foreground">Composition, lighting, lenses, and film looks for realistic frames.</div>
            <Link to="/guides/text-to-image-prompts-cinematic-shots" className="inline-flex"><Button>Read Guide</Button></Link>
          </Card>
          <Card className="p-5 space-y-2">
            <div className="text-xl font-semibold">YouTube Thumbnail Best Practices for CTR</div>
            <div className="text-sm text-muted-foreground">Bold titles, contrast, focal subject, and export size tips.</div>
            <Link to="/guides/youtube-thumbnail-best-practices-ctr" className="inline-flex"><Button>Read Guide</Button></Link>
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <a href={`${import.meta.env.BASE_URL}`} className="underline">Text to image generator</a>
          <span className="mx-2">•</span>
          <Link to="/youtube-thumbnail" className="underline">YouTube thumbnail maker</Link>
        </div>
      </div>
    </div>
  );
};

export default Guides;