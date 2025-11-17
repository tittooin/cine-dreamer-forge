// Minimal WebGL shader utils for LUT, blend, vignette previews

export async function applyLUTPreview(canvasEl, lutImageUrl) {
  if (!canvasEl) return null;
  const glCanvas = document.createElement('canvas');
  glCanvas.width = canvasEl.width;
  glCanvas.height = canvasEl.height;
  glCanvas.style.position = 'absolute';
  glCanvas.style.left = canvasEl.style.left || '0px';
  glCanvas.style.top = canvasEl.style.top || '0px';
  glCanvas.style.pointerEvents = 'none';
  glCanvas.style.zIndex = '10';

  const gl = glCanvas.getContext('webgl');
  if (!gl) return null;

  const vsSource = `attribute vec2 a_position;varying vec2 v_uv;void main(){v_uv=(a_position+1.0)/2.0;gl_Position=vec4(a_position,0.0,1.0);}`;
  const fsSource = `precision mediump float;varying vec2 v_uv;uniform sampler2D u_tex;uniform sampler2D u_lut;uniform vec2 u_resolution;vec3 sampleLUT(vec3 color){float blueColor=color.b*63.0;vec2 quad1;quad1.y=floor(blueColor/8.0);quad1.x=floor(blueColor)-quad1.y*8.0;vec2 quad2;quad2.y=floor((blueColor+1.0)/8.0);quad2.x=floor(blueColor+1.0)-quad2.y*8.0;vec2 texPos1;texPos1.x=(quad1.x*64.0 + color.r*63.0)/512.0;texPos1.y=(quad1.y*64.0 + color.g*63.0)/512.0;vec2 texPos2;texPos2.x=(quad2.x*64.0 + color.r*63.0)/512.0;texPos2.y=(quad2.y*64.0 + color.g*63.0)/512.0;vec3 result1=texture2D(u_lut, texPos1).rgb;vec3 result2=texture2D(u_lut, texPos2).rgb;float mixFactor=fract(blueColor);return mix(result1, result2, mixFactor);}void main(){vec2 uv=v_uv;vec4 color=texture2D(u_tex, uv);gl_FragColor=vec4(sampleLUT(color.rgb), color.a);} `;

  const compile = (src, type) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
  const vs = compile(vsSource, gl.VERTEX_SHADER);
  const fs = compile(fsSource, gl.FRAGMENT_SHADER);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);

  const pos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pos);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_position'); gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Create textures
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const lutTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, lutTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Upload LUT image
  const lutImg = await loadImage(lutImageUrl);
  gl.bindTexture(gl.TEXTURE_2D, lutTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lutImg);

  // Upload source framebuffer from canvas
  const srcImg = await captureCanvasImage(canvasEl);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcImg);

  const uTex = gl.getUniformLocation(prog, 'u_tex');
  const uLut = gl.getUniformLocation(prog, 'u_lut');
  gl.uniform1i(uTex, 0);
  gl.uniform1i(uLut, 1);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lutTex);

  gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  return glCanvas;
}

export async function applyVignettePreview(canvasEl, strength = 0.3) {
  const overlay = document.createElement('canvas');
  overlay.width = canvasEl.width; overlay.height = canvasEl.height;
  overlay.style.position = 'absolute'; overlay.style.left = canvasEl.style.left || '0px'; overlay.style.top = canvasEl.style.top || '0px'; overlay.style.pointerEvents = 'none'; overlay.style.zIndex = '9';
  const ctx = overlay.getContext('2d');
  const grad = ctx.createRadialGradient(overlay.width/2, overlay.height/2, Math.min(overlay.width, overlay.height)/4, overlay.width/2, overlay.height/2, Math.max(overlay.width, overlay.height)/2);
  grad.addColorStop(0, `rgba(0,0,0,0)`);
  grad.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = grad; ctx.fillRect(0,0,overlay.width, overlay.height);
  return overlay;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img); img.onerror = reject; img.src = url;
  });
}

function captureCanvasImage(canvasEl) {
  return new Promise((resolve) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img); img.src = canvasEl.toDataURL('image/png');
  });
}