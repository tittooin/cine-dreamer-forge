import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Sparkles } from "lucide-react";

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setGeneratedImage(data.imageUrl);
      toast.success("Image generated successfully!");
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;

    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `ai-generated-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Image downloaded!");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-primary rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
        <div className="absolute top-0 -right-4 w-96 h-96 bg-accent rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-75" />
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-primary-glow rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-150" />
      </div>

      <div className="relative z-10 w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-full">
            <img src="/logo.png" alt="TittoosAI logo" className="w-6 h-6 rounded-sm" />
            <span className="text-sm text-muted-foreground">Tittoos AI</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary via-accent to-primary-glow bg-clip-text text-transparent animate-gradient">
            Create Cinematic Images
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transform your imagination into realistic, cinematic images with AI
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-2xl backdrop-blur-sm">
          <Textarea
            placeholder="Describe your image... (e.g., 'A majestic lion in golden sunset, cinematic lighting, 8k, ultra realistic')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] text-lg resize-none bg-input border-border focus-visible:ring-primary"
            disabled={isGenerating}
          />
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-300 shadow-[0_0_20px_rgba(124,58,237,0.5)] hover:shadow-[0_0_30px_rgba(124,58,237,0.7)]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Image
              </>
            )}
          </Button>
        </div>

        {/* Image Display */}
        {generatedImage && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-2xl backdrop-blur-sm animate-in fade-in duration-500">
            <div className="relative group">
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full h-auto rounded-xl shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl flex items-end justify-center pb-6">
                <Button
                  onClick={handleDownload}
                  variant="secondary"
                  className="shadow-lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Image
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
