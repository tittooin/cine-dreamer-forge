import React, { useEffect, useRef, useState, Suspense } from 'react';
const AIPanel = React.lazy(() => import('./components/AIPanel'));
const BrandingPanel = React.lazy(() => import('./ui/BrandingPanel.jsx'));
const PresenceBar = React.lazy(() => import('./ui/PresenceBar.jsx'));
const CursorOverlay = React.lazy(() => import('./ui/CursorOverlay.jsx'));
const CommentsPanel = React.lazy(() => import('./ui/CommentsPanel.jsx'));
import Tabs from './components/Tabs';
const EffectsPanel = React.lazy(() => import('./effects/EffectsPanel.jsx'));
import PagePanel from './pages/PagePanel.jsx';
import { usePagesManager } from './pages/usePagesManager.js';
import { exportPDF } from './pages/exportPDF.js';
import { exportAllPNG } from './pages/exportAllPNG.js';
import TemplatePanel from './components/TemplatePanel';
import AssetsPanel from './components/AssetsPanel';
import { saveRecentProjects } from './utils/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@radix-ui/react-slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saveProject, loadProject, clearProject } from './storage';
import EditorCanvas from './components/EditorCanvas';
import { useAuth } from './cloud/useAuth';
import LoginModal from './ui/LoginModal';
import { saveProjectToCloud, listProjects } from './cloud/projectsApi';
import AnimationPanel from './ui/AnimationPanel.jsx';
import TimelinePanel from './ui/TimelinePanel.jsx';
import { useAnimationManager } from './animation/useAnimationManager.js';
import { useMediaManager } from './media/useMediaManager.js';
import MediaTimelinePanel from './media/TimelinePanel.jsx';

type FabricModule = typeof import('fabric');

type SizePreset = { label: string; width: number; height: number };
const SIZE_PRESETS: SizePreset[] = [
  { label: 'YouTube 1280×720', width: 1280, height: 720 },
  { label: 'HD 1920×1080', width: 1920, height: 1080 },
  { label: 'Square 1080×1080', width: 1080, height: 1080 },
  { label: 'Poster 2000×3000', width: 2000, height: 3000 },
];

const PosterEditor: React.FC = () => {
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const [fabric, setFabric] = useState<FabricModule['fabric'] | null>(null);
  const [canvas, setCanvas] = useState<FabricModule['fabric']['Canvas'] | null>(null);
  const [activeTab, setActiveTab] = useState<'pages' | 'tools' | 'templates' | 'assets' | 'ai' | 'branding' | 'animation' | 'media'>('pages');
  const [preset, setPreset] = useState<SizePreset>(SIZE_PRESETS[0]);
  const [bgColor, setBgColor] = useState<string>('#111827');
  const [selected, setSelected] = useState<FabricModule['fabric']['Object'] | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [textValue, setTextValue] = useState<string>('Your Headline');
  const [fontSize, setFontSize] = useState<number>(96);
  const [fill, setFill] = useState<string>('#ffffff');
  const [stroke, setStroke] = useState<string>('#000000');
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [angle, setAngle] = useState<number>(0);
  const { user, loading: authLoading, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [projectName, setProjectName] = useState<string>('Untitled Poster');
  // Realtime collaboration: presence, cursors, comments
  const [cursors, setCursors] = useState<Map<string, any>>(new Map());
  const [avatars, setAvatars] = useState<Map<string, any>>(new Map());
  const [comments, setComments] = useState<any[]>([]);
  const [commentMode, setCommentMode] = useState(false);
  const [preparedComment, setPreparedComment] = useState<string>('');
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const realtimeRef = useRef<any>(null);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const projectIdRef = useRef<string>(new URLSearchParams(window.location.search).get('project_id') || 'local');
  const projectId = projectIdRef.current;

  // Env gating for cloud features to avoid noisy network errors in local dev
  const HAS_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const POSTER_CLOUD_ENABLED = (import.meta.env.VITE_POSTER_CLOUD_ENABLED ?? '1') !== '0';

  // Runtime cloud toggle persisted in LocalStorage
  const CLOUD_KEY = 'poster:cloud_enabled';
  const [cloudEnabled, setCloudEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(CLOUD_KEY);
      if (raw === '0') return false;
      if (raw === '1') return true;
    } catch {}
    return HAS_SUPABASE && POSTER_CLOUD_ENABLED;
  });
  useEffect(() => {
    try { localStorage.setItem(CLOUD_KEY, cloudEnabled ? '1' : '0'); } catch {}
  }, [cloudEnabled]);

  // Pages manager: load/switch pages; keep one Fabric canvas instance
  const pagesMgr = usePagesManager({
    projectId,
    onLoadCanvasJSON: (json) => { if (canvas) { canvas.clear(); canvas.loadFromJSON(json, () => canvas.renderAll()); } },
    getCanvasJSON: () => (canvas ? canvas.toJSON() : null),
    getCanvasPNG: (idx) => {
      // If idx is undefined, return current page data URL
      if (!canvas) return null;
      if (typeof idx !== 'number') return canvas.toDataURL({ format: 'png', quality: 0.92 });
      // Temporarily render that page and capture PNG, then restore current
      try {
        const currentJSON = canvas.toJSON();
        const target = pagesMgr.pages[idx];
        if (!target) return null;
        canvas.clear();
        canvas.loadFromJSON(target.canvas_json, () => {
          canvas.renderAll();
        });
        const url = canvas.toDataURL({ format: 'png', quality: 0.92 });
        // Restore
        canvas.clear();
        canvas.loadFromJSON(currentJSON, () => canvas.renderAll());
        return url;
      } catch {
        return null;
      }
    },
    cloudEnabled,
  });

  // Animation manager
  const animMgr = useAnimationManager({
    canvas,
    pagesMgr,
    projectId,
    pageId: pagesMgr.activePageId,
    user,
    cloudEnabled,
  });

  // Media manager
  const mediaMgr = useMediaManager({
    canvas,
    pagesMgr,
    projectId,
    pageId: pagesMgr.activePageId,
    user,
    cloudEnabled,
  });

  // Lazy-load Fabric only on this route
  useEffect(() => {
    let disposed = false;
    (async () => {
      const mod = await import('fabric');
      if (disposed) return;
      setFabric(mod.fabric);
    })();
    return () => { disposed = true; };
  }, []);

  // Initialize canvas once Fabric is ready
  useEffect(() => {
    if (!fabric || !canvasEl.current) return;
    const c = new fabric.Canvas(canvasEl.current, {
      preserveObjectStacking: true,
      selection: true,
    });
    c.setWidth(preset.width);
    c.setHeight(preset.height);
    c.setBackgroundColor(bgColor, () => c.renderAll());

    // Selection listeners
    c.on('selection:created', () => setSelected(c.getActiveObject() ?? null));
    c.on('selection:updated', () => setSelected(c.getActiveObject() ?? null));
    c.on('selection:cleared', () => setSelected(null));
    c.on('object:added', () => { saveProject(c.toJSON()); try { saveRecentProjects([{ ts: Date.now(), json: c.toJSON() }]); } catch {} });
    c.on('object:modified', () => saveProject(c.toJSON()));
    c.on('object:removed', () => saveProject(c.toJSON()));

    // Load project if present
    const saved = loadProject();
    if (saved) {
      try {
        c.loadFromJSON(saved, () => c.renderAll());
      } catch {}
    }

    setCanvas(c);
    return () => {
      c.dispose();
      setCanvas(null);
      setSelected(null);
    };
  }, [fabric]);

  // Load latest cloud project when user logs in
  useEffect(() => {
    if (!user || !canvas) return;
    (async () => {
      try {
        const projects = await listProjects(user.id, 0, 1);
        if (projects && projects.length) {
          setProjectName(projects[0].name || 'Untitled Poster');
          canvas.clear();
          canvas.loadFromJSON(projects[0].canvas_json, () => canvas.renderAll());
        }
      } catch (_) {}
    })();
  }, [user, canvas]);

  // Update canvas background when bgColor changes
  useEffect(() => {
    if (canvas) {
      canvas.setBackgroundColor(bgColor, () => canvas.renderAll());
      saveProject(canvas.toJSON());
    }
  }, [bgColor]);

  // Update canvas size when preset changes
  useEffect(() => {
    if (canvas) {
      canvas.setWidth(preset.width);
      canvas.setHeight(preset.height);
      canvas.renderAll();
      saveProject(canvas.toJSON());
    }
  }, [preset]);

  // Initialize Supabase Realtime when canvas is ready and page changes
  useEffect(() => {
    if (!canvas) return;
    let detach: any | null = null;
    (async () => {
      const [{ useRealtimeProject }, { attachPatchSenders }] = await Promise.all([
        import('./realtime/useRealtimeProject.js'),
        import('./realtime/sendPatch.js'),
      ]);
      const rt = useRealtimeProject({ projectId, pageId: pagesMgr.activePageId, canvas, user: user || { id: 'guest', username: 'Guest' } });
      realtimeRef.current = rt;
      rt.subscribe((type: string, data: any) => {
        if (type === 'presence') {
          setCursors(data.cursors);
          setAvatars(data.avatars);
        } else if (type === 'comment') {
          setComments((prev) => [...prev, data]);
        }
      });
      await rt.start();
      detach = attachPatchSenders({ canvas, projectId, pageId: pagesMgr.activePageId, user: user || { id: 'guest', username: 'Guest' } });
      setRealtimeReady(true);
    })();
    return () => {
      try { detach && detach(); } catch {}
      try { realtimeRef.current && realtimeRef.current.stop(); } catch {}
    };
  }, [canvas, user, projectId, pagesMgr.activePageId]);

  // Cursor broadcasting
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el || !realtimeRef.current) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      realtimeRef.current.onMouseMove(x, y);
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, [realtimeReady]);

  // Comment placement when in comment mode
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el || !realtimeRef.current) return;
    const onClick = (e: MouseEvent) => {
      if (!commentMode || !preparedComment) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      realtimeRef.current.addComment({ x, y, text: preparedComment });
      setPreparedComment('');
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [commentMode, preparedComment, realtimeReady]);

  const addText = () => {
    if (!fabric || !canvas) return;
    const txt = new fabric.Textbox(textValue || 'Text', {
      left: 80,
      top: 80,
      fontSize,
      fontFamily: 'Poppins',
      fill,
      stroke,
      strokeWidth,
      fontWeight: '700',
    });
    canvas.add(txt);
    canvas.setActiveObject(txt);
    canvas.renderAll();
  };

  const addImageFromFile = async (file: File) => {
    if (!fabric || !canvas) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const fImg = new fabric.Image(img, {
          left: 120,
          top: 120,
          scaleX: 0.5,
          scaleY: 0.5,
        });
        canvas.add(fImg);
        canvas.setActiveObject(fImg);
        canvas.renderAll();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const addImageFromUrl = async () => {
    if (!fabric || !canvas || !imageUrl) return;
    fabric.Image.fromURL(imageUrl, (img) => {
      img.set({ left: 120, top: 120, crossOrigin: 'anonymous' as any });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    }, { crossOrigin: 'anonymous' });
  };

  const removeSelected = () => {
    if (!canvas || !selected) return;
    canvas.remove(selected);
    setSelected(null);
    canvas.discardActiveObject();
    canvas.renderAll();
  };

  const bringForward = () => {
    if (!canvas || !selected) return;
    canvas.bringForward(selected);
    canvas.renderAll();
  };
  const sendBackward = () => {
    if (!canvas || !selected) return;
    canvas.sendBackwards(selected);
    canvas.renderAll();
  };
  const bringToFront = () => {
    if (!canvas || !selected) return;
    canvas.bringToFront(selected);
    canvas.renderAll();
  };
  const sendToBack = () => {
    if (!canvas || !selected) return;
    canvas.sendToBack(selected);
    canvas.renderAll();
  };

  const exportPNG = () => {
    if (!canvas) return;
    const url = canvas.toDataURL({ format: 'png', quality: 1.0 });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'poster.png';
    a.click();
  };
  const exportJPEG = () => {
    if (!canvas) return;
    const url = canvas.toDataURL({ format: 'jpeg', quality: 0.92 });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'poster.jpg';
    a.click();
  };

  const applyTemplateJSON = (json: any) => {
    if (!canvas) return;
    canvas.clear();
    canvas.loadFromJSON(json, () => canvas.renderAll());
  };

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new Blob([u8arr], { type: mime });
  };

  const saveCloudNow = async () => {
    if (!user || !canvas) { setLoginOpen(true); return; }
    if (!cloudEnabled) { return; }
    try {
      const preview = canvas.toDataURL({ format: 'png', quality: 0.9 });
      const blob = dataUrlToBlob(preview);
      await saveProjectToCloud(user.id, projectName, canvas.toJSON(), blob);
    } catch (e) {
      // swallow errors here, user can rely on local fallback
    }
  };

  // Autosave to cloud every 10s when logged in
  useEffect(() => {
    if (!user || !canvas || !cloudEnabled) return;
    const id = setInterval(() => { saveCloudNow(); }, 10000);
    return () => clearInterval(id);
  }, [user, canvas, projectName, cloudEnabled]);

  // Properties updates
  useEffect(() => {
    if (!selected || !canvas || !fabric) return;
    if (selected.type === 'textbox' || selected.type === 'text') {
      (selected as any).set({
        fontSize,
        fill,
        stroke,
        strokeWidth,
      });
      selected.set('angle', angle);
      canvas.renderAll();
    } else {
      selected.set('angle', angle);
      canvas.renderAll();
    }
  }, [fontSize, fill, stroke, strokeWidth, angle]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Embedded within existing header/footer via App.tsx; this page uses site theme */}
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Cloud status banner */}
        {!cloudEnabled && (
          <div className="mb-3 rounded-md border border-yellow-300 bg-yellow-50 text-yellow-900 px-3 py-2 text-xs flex items-center justify-between">
            <span>Cloud is disabled — running in local-only mode.</span>
            <div className="flex items-center gap-2">
              {!HAS_SUPABASE && <span className="text-[11px]">Supabase env not configured</span>}
              <button className="px-2 py-1 border rounded" onClick={() => setCloudEnabled(true)}>Enable Cloud</button>
            </div>
          </div>
        )}
        {cloudEnabled && !HAS_SUPABASE && (
          <div className="mb-3 rounded-md border border-orange-300 bg-orange-50 text-orange-900 px-3 py-2 text-xs flex items-center justify-between">
            <span>Cloud enabled, but Supabase env is missing — uploads will be skipped.</span>
            <button className="px-2 py-1 border rounded" onClick={() => setCloudEnabled(false)}>Disable Cloud</button>
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Input className="w-48" value={projectName} onChange={(e)=>setProjectName(e.target.value)} placeholder="Project name" />
            <Button variant="outline" onClick={saveCloudNow}>Save Project</Button>
          </div>
          <div className="flex items-center gap-2">
            {authLoading ? (
              <span className="text-xs">Checking account…</span>
            ) : user ? (
              <>
                <span className="text-xs">{user.email ?? 'Logged in'}</span>
                <Button variant="secondary" onClick={()=>logout()}>Logout</Button>
              </>
            ) : (
              <Button onClick={()=>setLoginOpen(true)}>Login</Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left Panel with Tabs */}
          <aside className="md:col-span-3 space-y-4">
            <Suspense fallback={<div />}> 
              <PresenceBar avatars={avatars} />
            </Suspense>
            <Tabs active={activeTab} onChange={setActiveTab} />

            {activeTab === 'pages' && (
              <div className="rounded-lg border border-border p-4">
                <PagePanel
                  pages={pagesMgr.pages}
                  activeIndex={pagesMgr.activeIndex}
                  onSwitch={pagesMgr.switchTo}
                  onAdd={pagesMgr.addPage}
                  onDuplicate={pagesMgr.duplicatePage}
                  onDelete={pagesMgr.deletePage}
                  onRename={pagesMgr.renamePage}
                  onReorder={pagesMgr.reorderPages}
                  onExportPDF={async () => {
                    await exportPDF({ pages: pagesMgr.pages, getCanvasPNG: (i) => pagesMgr.getCanvasPNG ? pagesMgr.getCanvasPNG(i) : null });
                  }}
                  onExportAllPNG={async () => {
                    await exportAllPNG({ pages: pagesMgr.pages, getCanvasPNG: (i) => pagesMgr.getCanvasPNG ? pagesMgr.getCanvasPNG(i) : null });
                  }}
                />
              </div>
            )}

            {activeTab === 'tools' && (
            <>
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold mb-3">Canvas Preset</h3>
              <Select value={preset.label} onValueChange={(val) => {
                const next = SIZE_PRESETS.find(p => p.label === val)!;
                setPreset(next);
              }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>
                  {SIZE_PRESETS.map(p => (
                    <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-3">
                <label className="text-xs text-muted-foreground">Background</label>
                <Input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Add Text</h3>
              <Textarea value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Type headline" />
              <Button onClick={addText} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground">Add Text</Button>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Add Image</h3>
              <Input type="file" accept="image/*" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addImageFromFile(f);
              }} />
              <div className="flex gap-2">
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Paste image URL" />
                <Button variant="secondary" onClick={addImageFromUrl}>Add</Button>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-2">
              <h3 className="text-sm font-semibold">Layers</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={bringForward}>Bring Forward</Button>
                <Button variant="outline" onClick={sendBackward}>Send Backward</Button>
                <Button variant="outline" onClick={bringToFront}>To Front</Button>
                <Button variant="outline" onClick={sendToBack}>To Back</Button>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-2">
              <h3 className="text-sm font-semibold">Export</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button className="bg-success text-success-foreground" onClick={exportPNG}>Export PNG</Button>
                <Button className="bg-warning text-warning-foreground" onClick={exportJPEG}>Export JPEG</Button>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-2">
              <Button variant="outline" onClick={() => { clearProject(); }}>Clear Saved</Button>
            </div>
            </>
            )}

            {activeTab === 'templates' && (
              <div className="rounded-lg border border-border p-4">
                <TemplatePanel onApplyCanvasJSON={applyTemplateJSON} cloudEnabled={cloudEnabled} />
              </div>
            )}

            {activeTab === 'assets' && (
              <div className="rounded-lg border border-border p-4">
                <AssetsPanel fabric={fabric} canvas={canvas} />
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="rounded-lg border border-border p-4">
                <Suspense fallback={<div className="text-sm text-muted-foreground">Loading AI tools…</div>}>
                  <AIPanel
                    fabric={fabric}
                    canvas={canvas}
                    applyCanvasJSON={applyTemplateJSON}
                    onApplyBgColor={(color: string) => setBgColor(color)}
                    onSaveTemplate={async (name: string) => { await saveCloudNow(); }}
                  />
                </Suspense>
              </div>
            )}

            {activeTab === 'branding' && (
              <div className="rounded-lg border border-border p-4">
                <Suspense fallback={<div className="text-sm text-muted-foreground">Loading Branding…</div>}>
                  <BrandingPanel fabric={fabric} canvas={canvas} />
                </Suspense>
              </div>
            )}
            {activeTab === 'effects' && (
              <div className="rounded-lg border border-border p-4">
                <Suspense fallback={<div className="text-sm text-muted-foreground">Loading Effects…</div>}>
                  <EffectsPanel canvas={canvas} projectId={projectId} pageId={pagesMgr.activePageId} user={user || { id: 'guest', username: 'Guest' }} />
                </Suspense>
              </div>
            )}
          </aside>

          {/* Center Canvas */}
          <main ref={canvasContainerRef} className="md:col-span-6 overflow-auto rounded-lg border border-border p-2 bg-card relative">
            <EditorCanvas canvasRef={canvasEl} />
            <Suspense fallback={<div />}> 
              <CursorOverlay cursors={cursors} />
            </Suspense>
            {/* Bottom Timeline: Animation or Media depending on tab */}
            {activeTab === 'animation' && (
              <TimelinePanel canvas={canvas} pagesMgr={pagesMgr} animMgr={animMgr} />
            )}
            {activeTab === 'media' && (
              <MediaTimelinePanel canvas={canvas} pagesMgr={pagesMgr} mediaMgr={mediaMgr} visible={true} />
            )}
          </main>

          {/* Right Properties Panel */}
          <aside className="md:col-span-3 space-y-4">
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold mb-3">Properties</h3>
              {selected ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Fill</label>
                    <Input type="color" value={fill} onChange={(e) => setFill(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Stroke</label>
                    <Input type="color" value={stroke} onChange={(e) => setStroke(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Stroke Width</label>
                    <Input type="number" min={0} max={16} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Font Size</label>
                    <Input type="number" min={8} max={300} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Rotate</label>
                    <Input type="number" min={-180} max={180} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
                  </div>
                  <div className="pt-2">
                    <Button variant="destructive" onClick={removeSelected}>Delete Selected</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select an object to edit.</p>
              )}
            </div>
            <Suspense fallback={<div />}> 
              <CommentsPanel
                comments={comments}
                enabled={commentMode}
                onToggle={setCommentMode}
                onAddComment={(text: string) => setPreparedComment(text)}
              />
            </Suspense>
            {activeTab === 'animation' && (
              <div className="rounded-lg border border-border p-4">
                <AnimationPanel canvas={canvas} pagesMgr={pagesMgr} animMgr={animMgr} />
              </div>
            )}
            {activeTab === 'media' && (
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="text-sm font-semibold">Media</div>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="text-xs block mb-1">Upload Video</label>
                    <input type="file" accept="video/*" onChange={async (e)=>{
                      const file = e.target.files?.[0]; if (!file) return;
                      const meta = await mediaMgr.uploadMedia(file);
                      // Link to a fabric object if desired; here we just add to video track
                      mediaMgr.addClip('video', { asset_id: meta.url, start: 0, duration: Math.max(1, meta.duration||10), in: 0, volume: 0, muted: true });
                    }} />
                  </div>
                  <div>
                    <label className="text-xs block mb-1">Upload Audio</label>
                    <input type="file" accept="audio/*" onChange={async (e)=>{
                      const file = e.target.files?.[0]; if (!file) return;
                      const meta = await mediaMgr.uploadMedia(file);
                      mediaMgr.addClip('audio', { asset_id: meta.url, start: 0, duration: Math.max(1, meta.duration||10), in: 0, volume: 1, muted: false });
                    }} />
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">Add clips to timeline from uploaded media. Drag to move; resize ends to trim; use controls under the canvas.</div>
              </div>
            )}
          </aside>
        </div>
      </div>
      <LoginModal open={loginOpen} onClose={()=>setLoginOpen(false)} />
    </div>
  );
};

export default PosterEditor;