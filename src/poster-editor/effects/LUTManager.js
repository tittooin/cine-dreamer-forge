// LUT Manager: built-in LUTs, file upload support, and preview application

export const BUILT_IN_LUTS = [
  { id: 'warm', name: 'Warm', url: 'https://cdn.example.com/luts/warm.png' },
  { id: 'cool', name: 'Cool', url: 'https://cdn.example.com/luts/cool.png' },
  { id: 'film', name: 'Film', url: 'https://cdn.example.com/luts/film.png' },
  { id: 'cinematic', name: 'Cinematic', url: 'https://cdn.example.com/luts/cinematic.png' },
  { id: 'pastel', name: 'Pastel', url: 'https://cdn.example.com/luts/pastel.png' },
  { id: 'vivid', name: 'Vivid', url: 'https://cdn.example.com/luts/vivid.png' },
  { id: 'neutral', name: 'Neutral', url: 'https://cdn.example.com/luts/neutral.png' },
  { id: 'mono', name: 'Mono', url: 'https://cdn.example.com/luts/mono.png' },
  { id: 'tealorange', name: 'Teal & Orange', url: 'https://cdn.example.com/luts/tealorange.png' },
  { id: 'matte', name: 'Matte', url: 'https://cdn.example.com/luts/matte.png' },
];

export async function loadLUTFromFile(file) {
  // Supports CUBE or PNG strip; for PNG we can use a blob URL directly
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) {
    return { id: `lut-${Date.now()}`, name: file.name, url: URL.createObjectURL(file) };
  }
  if (name.endsWith('.cube')) {
    // TODO: parse CUBE; for preview, recommend converting to PNG LUT strip server-side
    return { id: `lut-${Date.now()}`, name: file.name, url: URL.createObjectURL(file), cube: true };
  }
  return null;
}