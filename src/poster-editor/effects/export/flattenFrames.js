// Export preflight: flatten effects and generate frame bitmaps for encoding

import { serializeEffects, applyEffects } from '../applyEffect.js';

export async function preflightExport({ canvas, fps = 30, durationSec = 5, globalLUT }) {
  const frames = Math.ceil(fps * durationSec);
  const snapshots = [];
  for (let i = 0; i < frames; i++) {
    // For now, just ensure effects applied and capture PNG
    const objs = canvas.getObjects();
    for (const obj of objs) {
      await applyEffects(canvas, obj, { preview: false });
    }
    const dataUrl = canvas.toDataURL({ format: 'png' });
    snapshots.push(dataUrl);
  }
  const ffmpeg = generateFFmpegGuidance({ fps, globalLUT });
  return { frames: snapshots, ffmpeg };
}

export function generateFFmpegGuidance({ fps, globalLUT }) {
  // Example commands: LUT and blending overlays
  const cmds = [];
  if (globalLUT?.cube) {
    cmds.push(`ffmpeg -r ${fps} -i frame_%04d.png -vf lut3d='${globalLUT.cubePath || 'global.cube'}' -c:v libx264 -pix_fmt yuv420p output.mp4`);
  } else if (globalLUT?.url) {
    cmds.push(`# Convert 2D LUT PNG to 3D LUT (.cube) offline or use gl shader for preview`);
    cmds.push(`ffmpeg -r ${fps} -i frame_%04d.png -c:v libx264 -pix_fmt yuv420p output.mp4`);
  } else {
    cmds.push(`ffmpeg -r ${fps} -i frame_%04d.png -c:v libx264 -pix_fmt yuv420p output.mp4`);
  }
  cmds.push(`# Blend example: overlay logo with screen blend using colorkey/alpha`);
  cmds.push(`ffmpeg -i output.mp4 -i overlay.png -filter_complex "[1]format=rgba,colorchannelmixer=aa=0.6[ol];[0][ol]overlay=x=10:y=10" blended.mp4`);
  return cmds.join('\n');
}