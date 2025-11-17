// Client export using canvas.captureStream and MediaRecorder. Merges audio from AudioEngine.
export async function exportWebM({ canvas, audioEngine, fps = 30, duration = 30 }) {
  const canvasStream = canvas?.getElement()?.captureStream?.(fps);
  const audioStream = audioEngine?.getMixedStream?.();
  const tracks = [];
  if (canvasStream) tracks.push(...canvasStream.getVideoTracks());
  if (audioStream) tracks.push(...audioStream.getAudioTracks());
  const stream = new MediaStream(tracks);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();
  await new Promise((r) => setTimeout(r, Math.min(duration, 120) * 1000));
  recorder.stop();
  await stopped;
  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  return { blob, url };
}