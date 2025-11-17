// Dynamically load Google Fonts

export function loadGoogleFonts({ heading, body, accent, weights = ['400','600','700'] }) {
  const families = [heading, body, accent].filter(Boolean);
  const unique = [...new Set(families)];
  if (!unique.length) return;
  const w = (Array.isArray(weights) ? weights : [weights]).join(';');
  const qs = unique.map(f => `${encodeURIComponent(f)}:${w}`).join('&family=');
  const href = `https://fonts.googleapis.com/css2?family=${qs}&display=swap`;
  ensureLink(href);
}

function ensureLink(href){
  const id = `gf-${btoa(href).replace(/=/g,'')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id; link.rel = 'stylesheet'; link.href = href;
  document.head.appendChild(link);
}