import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import PosterEditor from "./pages/PosterEditor";
import Login from "./pages/Login";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Refunds from "./pages/Refunds";
import Dashboard from "./pages/Dashboard";
import ThumbnailLab from "./pages/ThumbnailLab";
import YoutubeThumbnail from "./pages/YoutubeThumbnail";
import Guides from "./pages/Guides";
import GuideCinematicPrompts from "./pages/GuideCinematicPrompts";
import GuideYoutubeCTR from "./pages/GuideYoutubeCTR";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        {/* Site-wide header with quick links and mobile menu */}
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="text-sm font-semibold">Tittoos AI</Link>
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-4 text-sm">
              <Link to="/guides" className="underline">Guides</Link>
              <Link to="/poster" className="underline">Poster</Link>
              <Link to="/youtube-thumbnail" className="underline">YouTube Thumbnail</Link>
            </nav>
            {/* Mobile hamburger menu */}
            <div className="md:hidden">
              <Drawer>
                <DrawerTrigger asChild>
                  <button className="inline-flex items-center gap-1 text-sm">
                    <Menu className="h-4 w-4" />
                    Menu
                  </button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Navigation</DrawerTitle>
                  </DrawerHeader>
                  <div className="px-4 pb-4 space-y-3">
                    <Link to="/" className="block underline">Home</Link>
                    <Link to="/guides" className="block underline">Guides</Link>
                    <Link to="/poster" className="block underline">Poster</Link>
                    <Link to="/youtube-thumbnail" className="block underline">YouTube Thumbnail</Link>
                  </div>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/poster" element={<PosterEditor />} />
          <Route path="/login" element={<Login />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          {/* Shipping route removed */}
          <Route path="/refunds" element={<Refunds />} />
          <Route path="/youtube-thumbnail" element={<YoutubeThumbnail />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="/guides/text-to-image-prompts-cinematic-shots" element={<GuideCinematicPrompts />} />
          <Route path="/guides/youtube-thumbnail-best-practices-ctr" element={<GuideYoutubeCTR />} />
          {import.meta.env.DEV && (
            // Local-only route for experimenting with thumbnails
            <Route path="/thumbnail-lab" element={<ThumbnailLab />} />
          )}
          {/* Hidden admin route: not linked anywhere */}
          <Route path="/admin-quiet-6b27c9" element={<Admin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
