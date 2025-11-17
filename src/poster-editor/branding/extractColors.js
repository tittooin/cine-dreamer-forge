// Extract dominant colors from an image using Canvas

export async function extractColorsFromImage(fileOrUrl, count = 5) {
  const img = await loadImage(fileOrUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width = Math.min(256, img.naturalWidth || img.width);
  const h = canvas.height = Math.min(256, img.naturalHeight || img.height);
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const buckets = new Map();
  // Simple quantization: reduce RGB to 64 buckets (4 bits per channel)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const key = `${r>>4}-${g>>4}-${b>>4}`;
    const prev = buckets.get(key) || { r:0, g:0, b:0, n:0 };
    prev.r += r; prev.g += g; prev.b += b; prev.n += 1;
    buckets.set(key, prev);
  }
  const ranked = [...buckets.entries()].map(([k,v])=>({
    hex: rgbToHex(Math.round(v.r/v.n), Math.round(v.g/v.n), Math.round(v.b/v.n)),
    n: v.n,
  })).sort((a,b)=>b.n-a.n);
  const palette = dedupeHexes(ranked.map(x=>x.hex)).slice(0, count);
  const [primary, secondary, accent, neutral] = palette;
  return { palette, theme: { primary, secondary, accent, neutral } };
}

export async function extractColorsFromWebsite(url) {
  // Try to load the site's favicon or fall back to screenshot service if provided
  // For safety, we just return a neutral modern palette when not possible in client
  return { palette: ['#0F172A','#60A5FA','#94A3B8','#FFFFFF'], theme: { primary: '#0F172A', secondary: '#60A5FA', accent: '#94A3B8', neutral: '#FFFFFF' } };
}

function rgbToHex(r,g,b){
  const h = (n)=>n.toString(16).padStart(2,'0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function dedupeHexes(arr){
  const set = new Set(); const out = [];
  for (const h of arr){ const k = h.toLowerCase(); if (!set.has(k)){ set.add(k); out.push(h); } }
  return out;
}

function loadImage(fileOrUrl){
  return new Promise((resolve,reject)=>{
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = ()=>resolve(img);
    img.onerror = reject;
    if (typeof fileOrUrl === 'string') img.src = fileOrUrl;
    else {
      const reader = new FileReader();
      reader.onload = ()=>{ img.src = reader.result; };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrUrl);
    }
  });
}