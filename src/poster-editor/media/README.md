Media timeline modules

Tracks and clip ops:
- Clips: { id, asset_id, start, duration, in, volume, muted, page_id, type }
- Actions: add, move, trim, split, delete, volume, play, pause, stop

Realtime:
- op_type: 'media-op', payload: { action, clip } or { action, ts }
- Canvas attaches _onMediaPatch handler to process incoming ops

Export:
- Client WebM via canvas.captureStream + MediaRecorder + mixed audio stream
- Server MP4 stub via Edge Function /functions/v1/media-export