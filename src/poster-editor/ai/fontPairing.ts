type FontPair = { heading: string; body: string; accent?: string };

export function getFontPairs(theme: 'default' | 'elegant' | 'retro'): FontPair[] {
  if (theme === 'elegant') {
    return [
      { heading: 'Playfair Display', body: 'Inter' },
      { heading: 'Cormorant Garamond', body: 'Nunito Sans' },
      { heading: 'Merriweather', body: 'Source Sans Pro' },
      { heading: 'Libre Baskerville', body: 'Work Sans' },
      { heading: 'Lora', body: 'Roboto' },
      { heading: 'DM Serif Display', body: 'Open Sans' },
      { heading: 'Prata', body: 'Inter' },
      { heading: 'Cinzel', body: 'Montserrat' },
      { heading: 'Playfair Display', body: 'Lato' },
      { heading: 'Bodoni Moda', body: 'Inter' },
    ];
  }
  if (theme === 'retro') {
    return [
      { heading: 'Bebas Neue', body: 'Roboto' },
      { heading: 'Pacifico', body: 'Open Sans' },
      { heading: 'Oswald', body: 'Inter' },
      { heading: 'Abril Fatface', body: 'Lato' },
      { heading: 'Monoton', body: 'Nunito Sans' },
      { heading: 'Shrikhand', body: 'Work Sans' },
      { heading: 'Krona One', body: 'Inter' },
      { heading: 'Luckiest Guy', body: 'Roboto' },
      { heading: 'Righteous', body: 'Inter' },
      { heading: 'Alfa Slab One', body: 'Open Sans' },
    ];
  }
  return [
    { heading: 'Poppins', body: 'Inter' },
    { heading: 'Montserrat', body: 'Lato' },
    { heading: 'Raleway', body: 'Open Sans' },
    { heading: 'Oswald', body: 'Roboto' },
    { heading: 'Rubik', body: 'Inter' },
    { heading: 'Heebo', body: 'Work Sans' },
    { heading: 'Nunito', body: 'Nunito Sans' },
    { heading: 'Archivo Black', body: 'Inter' },
    { heading: 'Playfair Display', body: 'Lato' },
    { heading: 'Merriweather', body: 'Source Sans Pro' },
  ];
}

export async function loadGoogleFont(fontFamily: string): Promise<void> {
  if (!fontFamily) return;
  const id = `gf-${fontFamily.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}