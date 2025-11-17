export type PaletteSet = { name: string; colors: string[] };

export function generatePalettes(): PaletteSet[] {
  return [
    { name: 'Pastel', colors: ['#F8EDEB', '#FEC5BB', '#FCD5CE', '#FAE1DD', '#E8E8E4'] },
    { name: 'Warm', colors: ['#8B1E3F', '#E07A5F', '#F2CC8F', '#81B29A', '#3D405B'] },
    { name: 'Luxury', colors: ['#0F0F0F', '#1E1E1E', '#D4AF37', '#B88A44', '#EEE4B1'] },
    { name: 'Retro', colors: ['#2D4057', '#F8BD7F', '#D15E49', '#8DA05A', '#F4E76E'] },
    { name: 'Neon', colors: ['#0D0221', '#00F0FF', '#FF00E0', '#39FF14', '#FFE81F'] },
  ];
}