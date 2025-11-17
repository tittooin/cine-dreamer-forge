export async function exportPDF({ pages, getCanvasPNG }) {
  if (!pages || !pages.length) return;
  // Lazy import jsPDF
  const { jsPDF } = await import('jspdf');
  const firstDataUrl = getCanvasPNG();
  if (!firstDataUrl) return;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });

  // Helper to add an image scaled to page
  const addPageImage = (doc, dataUrl) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    // Insert centered; jsPDF auto-scales with width/height params
    doc.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
  };

  // First page
  addPageImage(pdf, firstDataUrl);

  // Remaining pages: switch canvas per page if needed
  for (let i = 1; i < pages.length; i++) {
    pdf.addPage();
    const dataUrl = getCanvasPNG(i);
    if (dataUrl) addPageImage(pdf, dataUrl);
  }

  pdf.save('poster-pages.pdf');
}