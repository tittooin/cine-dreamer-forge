// Defines BrandKit structure and simple helpers

export function makeBrandKit({ name = 'My Brand', colors = [], fonts = {}, vibe_words = [], shadows = {}, border_styles = {} }) {
  return {
    brand_name: name,
    colors,
    fonts: {
      heading: fonts.heading || 'Poppins',
      body: fonts.body || 'Inter',
      accent: fonts.accent || fonts.heading || 'Poppins',
      weights: fonts.weights || ['400','600','700'],
    },
    vibe_words,
    shadows,
    border_styles,
  };
}

export const DEFAULT_BRAND_RULES = {
  spacing: { padding: 16, margin: 12 },
  accents: { strokeWidth: 2 },
  typography_rules: { headingScale: 1.2, lineHeight: 1.2 },
};

export const PRESET_FONTS = {
  luxury: { heading: 'Playfair Display', body: 'Inter', accent: 'Lora', weights: ['400','600','700'] },
  modern: { heading: 'Montserrat', body: 'Inter', accent: 'Poppins', weights: ['400','600','700'] },
  minimal: { heading: 'Work Sans', body: 'Inter', accent: 'DM Sans', weights: ['400','600'] },
  bold: { heading: 'Bebas Neue', body: 'Inter', accent: 'Oswald', weights: ['400','700'] },
  playful: { heading: 'Baloo 2', body: 'Nunito', accent: 'Fredoka', weights: ['400','700'] },
};

export const PRESET_COLORS = {
  luxury: ['#000000','#CBA135','#222222','#FFFFFF'],
  modern: ['#0F172A','#60A5FA','#94A3B8','#FFFFFF'],
  minimal: ['#111827','#F3F4F6','#9CA3AF','#FFFFFF'],
  bold: ['#0F172A','#EF4444','#F59E0B','#10B981'],
  playful: ['#2563EB','#22D3EE','#F472B6','#34D399','#FBBF24'],
};