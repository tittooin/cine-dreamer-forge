export type TemplateItem = {
  id: string;
  name: string;
  thumbnail: string; // base64 or public URL
  canvasJSON: any;
};

export const DEFAULT_TEMPLATE_FILES = [
  { file: 'classic_wedding.json', name: 'Classic Wedding', thumb: 'https://via.placeholder.com/300x200.png?text=Classic+Wedding' },
  { file: 'modern_sale.json', name: 'Modern Sale', thumb: 'https://via.placeholder.com/300x200.png?text=Modern+Sale' },
  { file: 'neon_party.json', name: 'Neon Party', thumb: 'https://via.placeholder.com/300x200.png?text=Neon+Party' },
  { file: 'minimal_quote.json', name: 'Minimal Quote', thumb: 'https://via.placeholder.com/300x200.png?text=Minimal+Quote' },
  { file: 'travel_poster.json', name: 'Travel Poster', thumb: 'https://via.placeholder.com/300x200.png?text=Travel+Poster' },
];

export async function loadDefaultTemplates(baseUrl: string = '/templates/') {
  const items: TemplateItem[] = [];
  for (const t of DEFAULT_TEMPLATE_FILES) {
    const res = await fetch(`${baseUrl}${t.file}`);
    const json = await res.json();
    items.push({ id: json.id, name: json.name ?? t.name, thumbnail: json.thumbnail ?? t.thumb, canvasJSON: json.canvasJSON });
  }
  return items;
}