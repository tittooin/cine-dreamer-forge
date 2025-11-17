type GenerateLayoutInput = {
  type: 'generate_layout';
  prompt: string;
  canvas: { width: number; height: number };
  variant?: number;
};

export async function callOpenAILayout(input: GenerateLayoutInput): Promise<any> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI key missing');
  const model = import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini';

  const system = `You generate Fabric.js layout JSON for posters. Respond ONLY with JSON containing keys: background (hex color), colorPalette (array of hex), fonts {heading, body}, and canvasJSON (Fabric.js toJSON schema). Place headline, subtitle, CTA, decorative rectangles. Keep JSON concise.`;
  const user = JSON.stringify(input);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
    }),
  });
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  try { return JSON.parse(content); } catch {
    throw new Error('AI response parse failed');
  }
}