// Server export stub: describes how to send frames/audio to an Edge Function
// This is a placeholder without credentials. Implement the server in supabase functions.

export async function exportMP4ServerStub({ frames, audioBuffers }) {
  // Example POST payload structure
  const payload = { frames, audio: audioBuffers };
  // Replace URL with your deployed Edge Function endpoint
  const endpoint = '/functions/v1/media-export';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Server export failed');
  const data = await res.json();
  // Expecting { url }
  return data;
}