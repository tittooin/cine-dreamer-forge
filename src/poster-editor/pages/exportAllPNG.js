export async function exportAllPNG({ pages, getCanvasPNG }) {
  if (!pages || !pages.length) return;
  for (let i = 0; i < pages.length; i++) {
    const dataUrl = getCanvasPNG(i);
    if (!dataUrl) continue;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${pages[i].name || 'page'}-${i + 1}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    await new Promise((r) => setTimeout(r, 50));
  }
}