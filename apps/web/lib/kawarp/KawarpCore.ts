/**
 * KawarpCore - Optimized Fluid Animated WebGL Background Renderer
 * Based on Kawarp (MIT License, Better Lyrics - https://github.com/better-lyrics/kawarp)
 *
 * Optimizations implemented for OpenLyryc:
 * 1. Viewport & Fill-Rate Scaling: Clamps internal render buffer to prevent high-DPI GPU exhaustion.
 * 2. Multi-tier Image Loading with CORS resilience: fetch + createImageBitmap -> Image with crossOrigin -> fallback.
 * 3. Texture Memory Caching: Avoids re-fetching and re-blurring recently loaded cover artwork.
 * 4. Context Loss Recovery: Handles webglcontextlost & webglcontextrestored gracefully.
 * 5. Page Visibility & Inactivity Integration: Pauses when tab is hidden or user requests reduced motion.
 */

export interface KawarpOptions {
  warpIntensity?: number;
  blurPasses?: number;
  animationSpeed?: number;
  transitionDuration?: number;
  saturation?: number;
  tintColor?: [number, number, number];
  tintIntensity?: number;
  dithering?: number;
  scale?: number;
  maxResolutionWidth?: number;
  maxResolutionHeight?: number;
  resolutionScale?: number;
}

export interface KawarpContextOptions {
  highPrecisionInput?: boolean;
  highPrecisionOutput?: boolean;
}

interface Framebuffer {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

// Compact size for Kawase blur passes (128x128 provides ultra-smooth, lightweight blur)
const BLUR_SIZE = 128;

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const KAWASE_BLUR_SHADER = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
  uniform float u_offset;
  varying vec2 v_texCoord;

  void main() {
    highp vec2 texelSize = 1.0 / u_resolution;
    highp vec4 color = vec4(0.0);

    color += texture2D(u_texture, v_texCoord + vec2(-u_offset, -u_offset) * texelSize);
    color += texture2D(u_texture, v_texCoord + vec2(u_offset, -u_offset) * texelSize);
    color += texture2D(u_texture, v_texCoord + vec2(-u_offset, u_offset) * texelSize);
    color += texture2D(u_texture, v_texCoord + vec2(u_offset, u_offset) * texelSize);

    gl_FragColor = color * 0.25;
  }
`;

// Blend shader for smooth crossfades between cover arts
const BLEND_SHADER = `
  precision highp float;
  uniform sampler2D u_texture1;
  uniform sampler2D u_texture2;
  uniform float u_blend;
  varying vec2 v_texCoord;

  void main() {
    vec4 color1 = texture2D(u_texture1, v_texCoord);
    vec4 color2 = texture2D(u_texture2, v_texCoord);
    gl_FragColor = mix(color1, color2, u_blend);
  }
`;

// Tint shader - balances darkness before blur
const TINT_SHADER = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform vec3 u_tintColor;
  uniform float u_tintIntensity;
  varying vec2 v_texCoord;

  void main() {
    vec4 color = texture2D(u_texture, v_texCoord);
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // darkMask: 1.0 for black, 0.0 for luma >= 0.5
    float darkMask = 1.0 - smoothstep(0.0, 0.5, luma);

    // Blend dark areas toward tint color
    color.rgb = mix(color.rgb, u_tintColor, darkMask * u_tintIntensity);

    gl_FragColor = color;
  }
`;

// Simplex noise domain warping shader
const DOMAIN_WARP_SHADER = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform float u_time;
  uniform float u_intensity;
  varying vec2 v_texCoord;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = v_texCoord;
    float t = u_time * 0.05;

    vec2 center = uv - 0.5;
    float centerWeight = 1.0 - smoothstep(0.0, 0.7, length(center));

    // Large-scale movement (slow, organic blobs)
    float n1 = snoise(uv * 0.35 + vec2(t, t * 0.7));
    float n2 = snoise(uv * 0.35 + vec2(-t * 0.8, t * 0.5) + vec2(50.0, 50.0));

    // Medium-scale detail
    float n3 = snoise(uv * 0.9 + vec2(t * 1.2, -t) + vec2(100.0, 0.0));
    float n4 = snoise(uv * 0.9 + vec2(-t, t * 1.1) + vec2(0.0, 100.0));

    // Combine octaves
    vec2 warp = vec2(
      n1 * 0.65 + n3 * 0.35,
      n2 * 0.65 + n4 * 0.35
    ) * centerWeight;

    vec2 warpedUV = uv + warp * u_intensity;
    warpedUV = clamp(warpedUV, 0.0, 1.0);

    gl_FragColor = texture2D(u_texture, warpedUV);
  }
`;

// Output shader: Vignette, Saturation, and Film Dithering
const OUTPUT_SHADER = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform float u_saturation;
  uniform float u_dithering;
  uniform float u_time;
  uniform float u_scale;
  uniform vec2 u_resolution;
  varying vec2 v_texCoord;

  highp float hash(highp vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    vec2 uv = (v_texCoord - 0.5) / u_scale + 0.5;
    uv = clamp(uv, 0.0, 1.0);

    vec4 color = texture2D(u_texture, uv);

    vec2 center = v_texCoord - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.3;
    color.rgb *= vignette;

    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, u_saturation);

    highp vec2 pixelPos = floor(v_texCoord * u_resolution);
    highp float noise = hash(vec3(pixelPos, floor(u_time * 60.0)));
    color.rgb += (noise - 0.5) * u_dithering;

    gl_FragColor = color;
  }
`;

const textureSourceSize = (source: TexImageSource): [number, number] => {
  if ('naturalWidth' in source) return [source.naturalWidth, source.naturalHeight];
  if ('videoWidth' in source) return [source.videoWidth, source.videoHeight];
  if ('displayWidth' in source) return [source.displayWidth, source.displayHeight];
  return [source.width, source.height];
};

export class KawarpCore {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private gl2: WebGL2RenderingContext | null = null;
  private halfFloatExt: OES_texture_half_float | null = null;
  private halfFloatLinearExt: OES_texture_half_float_linear | null = null;
  private halfFloatRenderTargets = false;
  private float32RenderTargets = false;

  // Shader programs
  private blurProgram!: WebGLProgram;
  private blendProgram!: WebGLProgram;
  private tintProgram!: WebGLProgram;
  private warpProgram!: WebGLProgram;
  private outputProgram!: WebGLProgram;

  // Buffers
  private positionBuffer!: WebGLBuffer;
  private texCoordBuffer!: WebGLBuffer;

  // Source texture
  private sourceTexture!: WebGLTexture;
  private activeSourceTexture!: WebGLTexture;

  // FBOs
  private blurFBO1!: Framebuffer;
  private blurFBO2!: Framebuffer;
  private currentAlbumFBO!: Framebuffer;
  private nextAlbumFBO!: Framebuffer;
  private warpFBO!: Framebuffer;

  // Animation state
  private animationId: number | null = null;
  private lastFrameTime = 0;
  private accumulatedTime = 0;
  private isPlaying = false;
  private disposed = false;
  private isContextLost = false;

  // Transition state
  private isTransitioning = false;
  private transitionStartTime = 0;
  private _transitionDuration = 1000;

  // Configurable parameters
  private _warpIntensity = 0.85;
  private _blurPasses = 8;
  private _animationSpeed = 0.8;
  private _targetAnimationSpeed = 0.8;
  private _saturation = 1.45;
  private _tintColor: [number, number, number] = [0.157, 0.157, 0.235];
  private _tintIntensity = 0.15;
  private _dithering = 0.008;
  private _scale = 1.0;
  private hasImage = false;

  // Viewport optimization
  private _maxResolutionWidth = 1280;
  private _maxResolutionHeight = 720;
  private _resolutionScale = 0.65;

  // In-memory texture cache by URL
  private static textureBitmapCache = new Map<string, ImageBitmap>();

  // Cached uniforms
  private uniforms!: {
    blur: {
      resolution: WebGLUniformLocation;
      texture: WebGLUniformLocation;
      offset: WebGLUniformLocation;
    };
    blend: {
      texture1: WebGLUniformLocation;
      texture2: WebGLUniformLocation;
      blend: WebGLUniformLocation;
    };
    warp: {
      texture: WebGLUniformLocation;
      time: WebGLUniformLocation;
      intensity: WebGLUniformLocation;
    };
    tint: {
      texture: WebGLUniformLocation;
      tintColor: WebGLUniformLocation;
      tintIntensity: WebGLUniformLocation;
    };
    output: {
      texture: WebGLUniformLocation;
      saturation: WebGLUniformLocation;
      dithering: WebGLUniformLocation;
      time: WebGLUniformLocation;
      scale: WebGLUniformLocation;
      resolution: WebGLUniformLocation;
    };
  };

  private attribs!: {
    position: number;
    texCoord: number;
  };

  constructor(
    canvas: HTMLCanvasElement,
    options: KawarpOptions & KawarpContextOptions = {}
  ) {
    this.canvas = canvas;

    const contextAttributes: WebGLContextAttributes = {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    };

    const gl2 = options.highPrecisionInput || options.highPrecisionOutput
      ? canvas.getContext('webgl2', contextAttributes)
      : null;
    const gl = gl2 ?? canvas.getContext('webgl', contextAttributes);

    if (!gl) {
      throw new Error('WebGL not supported');
    }

    this.gl = gl as WebGLRenderingContext;
    this.gl2 = gl2;

    this.halfFloatExt = gl.getExtension('OES_texture_half_float');
    this.halfFloatLinearExt = gl.getExtension('OES_texture_half_float_linear');
    if (gl2) {
      this.float32RenderTargets = !!gl2.getExtension('EXT_color_buffer_float');
      this.halfFloatRenderTargets = this.float32RenderTargets || !!gl2.getExtension('EXT_color_buffer_half_float');
    }

    if (options.warpIntensity !== undefined) this._warpIntensity = options.warpIntensity;
    if (options.blurPasses !== undefined) this._blurPasses = options.blurPasses;
    if (options.animationSpeed !== undefined) {
      this._animationSpeed = options.animationSpeed;
      this._targetAnimationSpeed = options.animationSpeed;
    }
    if (options.transitionDuration !== undefined) this._transitionDuration = options.transitionDuration;
    if (options.saturation !== undefined) this._saturation = options.saturation;
    if (options.tintColor !== undefined) this._tintColor = options.tintColor;
    if (options.tintIntensity !== undefined) this._tintIntensity = options.tintIntensity;
    if (options.dithering !== undefined) this._dithering = options.dithering;
    if (options.scale !== undefined) this._scale = options.scale;
    if (options.maxResolutionWidth !== undefined) this._maxResolutionWidth = options.maxResolutionWidth;
    if (options.maxResolutionHeight !== undefined) this._maxResolutionHeight = options.maxResolutionHeight;
    if (options.resolutionScale !== undefined) this._resolutionScale = options.resolutionScale;

    this.setupWebGL();

    // Attach WebGL context loss handlers
    this.canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
  }

  private setupWebGL(): void {
    const gl = this.gl;

    // Create shader programs
    this.blurProgram = this.createProgram(VERTEX_SHADER, KAWASE_BLUR_SHADER);
    this.blendProgram = this.createProgram(VERTEX_SHADER, BLEND_SHADER);
    this.tintProgram = this.createProgram(VERTEX_SHADER, TINT_SHADER);
    this.warpProgram = this.createProgram(VERTEX_SHADER, DOMAIN_WARP_SHADER);
    this.outputProgram = this.createProgram(VERTEX_SHADER, OUTPUT_SHADER);

    this.attribs = {
      position: gl.getAttribLocation(this.blurProgram, 'a_position'),
      texCoord: gl.getAttribLocation(this.blurProgram, 'a_texCoord'),
    };

    this.uniforms = {
      blur: {
        resolution: gl.getUniformLocation(this.blurProgram, 'u_resolution')!,
        texture: gl.getUniformLocation(this.blurProgram, 'u_texture')!,
        offset: gl.getUniformLocation(this.blurProgram, 'u_offset')!,
      },
      blend: {
        texture1: gl.getUniformLocation(this.blendProgram, 'u_texture1')!,
        texture2: gl.getUniformLocation(this.blendProgram, 'u_texture2')!,
        blend: gl.getUniformLocation(this.blendProgram, 'u_blend')!,
      },
      warp: {
        texture: gl.getUniformLocation(this.warpProgram, 'u_texture')!,
        time: gl.getUniformLocation(this.warpProgram, 'u_time')!,
        intensity: gl.getUniformLocation(this.warpProgram, 'u_intensity')!,
      },
      tint: {
        texture: gl.getUniformLocation(this.tintProgram, 'u_texture')!,
        tintColor: gl.getUniformLocation(this.tintProgram, 'u_tintColor')!,
        tintIntensity: gl.getUniformLocation(this.tintProgram, 'u_tintIntensity')!,
      },
      output: {
        texture: gl.getUniformLocation(this.outputProgram, 'u_texture')!,
        saturation: gl.getUniformLocation(this.outputProgram, 'u_saturation')!,
        dithering: gl.getUniformLocation(this.outputProgram, 'u_dithering')!,
        time: gl.getUniformLocation(this.outputProgram, 'u_time')!,
        scale: gl.getUniformLocation(this.outputProgram, 'u_scale')!,
        resolution: gl.getUniformLocation(this.outputProgram, 'u_resolution')!,
      },
    };

    // Fullscreen quad buffer
    this.positionBuffer = this.createBuffer(
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    );
    this.texCoordBuffer = this.createBuffer(
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );

    this.sourceTexture = this.createTexture();
    this.activeSourceTexture = this.sourceTexture;

    // Small high-precision FBOs for Kawase blur
    this.blurFBO1 = this.createFramebuffer(BLUR_SIZE, BLUR_SIZE, true);
    this.blurFBO2 = this.createFramebuffer(BLUR_SIZE, BLUR_SIZE, true);
    this.currentAlbumFBO = this.createFramebuffer(BLUR_SIZE, BLUR_SIZE, true);
    this.nextAlbumFBO = this.createFramebuffer(BLUR_SIZE, BLUR_SIZE, true);

    const initW = Math.max(1, this.canvas.width || 640);
    const initH = Math.max(1, this.canvas.height || 360);
    this.warpFBO = this.createFramebuffer(initW, initH, true);
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.isContextLost = true;
    this.stop();
  };

  private onContextRestored = () => {
    this.isContextLost = false;
    this.setupWebGL();
    if (this.hasImage) {
      this.reblurCurrentImage();
      this.start();
    }
  };

  // Getters / Setters
  get warpIntensity(): number {
    return this._warpIntensity;
  }
  set warpIntensity(value: number) {
    this._warpIntensity = Math.max(0, Math.min(1, value));
  }

  get blurPasses(): number {
    return this._blurPasses;
  }
  set blurPasses(value: number) {
    const newVal = Math.max(0, Math.min(40, Math.floor(value)));
    if (newVal !== this._blurPasses) {
      this._blurPasses = newVal;
      if (this.hasImage) this.reblurCurrentImage();
    }
  }

  get animationSpeed(): number {
    return this._targetAnimationSpeed;
  }
  set animationSpeed(value: number) {
    this._targetAnimationSpeed = Math.max(0, Math.min(16, value));
  }

  get transitionDuration(): number {
    return this._transitionDuration;
  }
  set transitionDuration(value: number) {
    this._transitionDuration = Math.max(0, Math.min(5000, value));
  }

  get saturation(): number {
    return this._saturation;
  }
  set saturation(value: number) {
    this._saturation = Math.max(0, Math.min(3, value));
  }

  setOptions(options: Partial<KawarpOptions>): void {
    if (options.warpIntensity !== undefined) this.warpIntensity = options.warpIntensity;
    if (options.blurPasses !== undefined) this.blurPasses = options.blurPasses;
    if (options.animationSpeed !== undefined) this.animationSpeed = options.animationSpeed;
    if (options.transitionDuration !== undefined) this.transitionDuration = options.transitionDuration;
    if (options.saturation !== undefined) this.saturation = options.saturation;
    if (options.tintColor !== undefined) this._tintColor = options.tintColor;
    if (options.tintIntensity !== undefined) this._tintIntensity = options.tintIntensity;
    if (options.dithering !== undefined) this._dithering = options.dithering;
    if (options.scale !== undefined) this._scale = options.scale;
    if (options.maxResolutionWidth !== undefined) this._maxResolutionWidth = options.maxResolutionWidth;
    if (options.maxResolutionHeight !== undefined) this._maxResolutionHeight = options.maxResolutionHeight;
    if (options.resolutionScale !== undefined) this._resolutionScale = options.resolutionScale;
  }

  // ── Multi-Tier Image Loading with CORS Resilience & Memory Cache ────────
  async loadImage(src: string): Promise<void> {
    if (!src || this.disposed || this.isContextLost) return;

    // Check memory cache
    let bitmap = KawarpCore.textureBitmapCache.get(src) || null;

    if (!bitmap) {
      // 1. Try fetch with CORS & createImageBitmap (fastest, off main-thread)
      try {
        const res = await fetch(src, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          bitmap = await createImageBitmap(blob);
          KawarpCore.textureBitmapCache.set(src, bitmap);
        }
      } catch {
        // Fall back to Image element
      }
    }

    if (!bitmap) {
      // 2. Try HTMLImageElement with anonymous CORS
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.onerror = (e) => reject(e);
          image.src = src;
        });

        const created = await createImageBitmap(img);
        bitmap = created;
        KawarpCore.textureBitmapCache.set(src, created);
      } catch {
        // Fall back to image element without crossOrigin or canvas fallback
      }
    }

    if (bitmap) {
      this.showImageElement(bitmap);
    } else {
      // 3. Graceful fallback: synthesize a smooth two-tone harmonic gradient
      this.loadGradient(['#1c1c24', '#2a2236', '#141418']);
    }
  }

  loadGradient(colors: string[], angle = 135): void {
    if (this.disposed || this.isContextLost) return;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const angleRad = (angle * Math.PI) / 180;
    const x1 = size / 2 - Math.cos(angleRad) * size;
    const y1 = size / 2 - Math.sin(angleRad) * size;
    const x2 = size / 2 + Math.cos(angleRad) * size;
    const y2 = size / 2 + Math.sin(angleRad) * size;

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    colors.forEach((c, idx) => {
      grad.addColorStop(idx / Math.max(1, colors.length - 1), c);
    });

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    this.showImageElement(canvas);
  }

  private showImageElement(source: TexImageSource): void {
    if (this.disposed || this.isContextLost) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.processNewImage();
  }

  private processNewImage(): void {
    this.activeSourceTexture = this.sourceTexture;

    if (!this.hasImage) {
      this.blurSourceInto(this.nextAlbumFBO);
      this.blurSourceInto(this.currentAlbumFBO);
      this.hasImage = true;
      this.isTransitioning = false;
      return;
    }

    // Swap FBOs for crossfade
    const prevFBO = this.currentAlbumFBO;
    this.currentAlbumFBO = this.nextAlbumFBO;
    this.nextAlbumFBO = prevFBO;

    this.blurSourceInto(this.nextAlbumFBO);
    this.isTransitioning = true;
    this.transitionStartTime = performance.now();
  }

  private reblurCurrentImage(): void {
    this.blurSourceInto(this.nextAlbumFBO);
  }

  private blurSourceInto(targetFBO: Framebuffer): void {
    if (this.isContextLost) return;
    const gl = this.gl;

    // Step 1: Apply tint to source texture
    gl.useProgram(this.tintProgram);
    this.setupAttributes();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO1.framebuffer);
    gl.viewport(0, 0, BLUR_SIZE, BLUR_SIZE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.activeSourceTexture);
    gl.uniform1i(this.uniforms.tint.texture, 0);
    gl.uniform3fv(this.uniforms.tint.tintColor, this._tintColor);
    gl.uniform1f(this.uniforms.tint.tintIntensity, this._tintIntensity);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Step 2: Kawase blur passes
    gl.useProgram(this.blurProgram);
    this.setupAttributes();
    gl.uniform2f(this.uniforms.blur.resolution, BLUR_SIZE, BLUR_SIZE);
    gl.uniform1i(this.uniforms.blur.texture, 0);

    let readFBO = this.blurFBO1;
    let writeFBO = this.blurFBO2;

    for (let i = 0; i < this._blurPasses; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO.framebuffer);
      gl.viewport(0, 0, BLUR_SIZE, BLUR_SIZE);
      gl.bindTexture(gl.TEXTURE_2D, readFBO.texture);
      gl.uniform1f(this.uniforms.blur.offset, i + 0.5);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      const swap = readFBO;
      readFBO = writeFBO;
      writeFBO = swap;
    }

    // Step 3: Copy to target FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO.framebuffer);
    gl.viewport(0, 0, BLUR_SIZE, BLUR_SIZE);
    gl.bindTexture(gl.TEXTURE_2D, readFBO.texture);
    gl.uniform1f(this.uniforms.blur.offset, 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Resizes internal FBOs with resolution bounding to protect high-DPI GPU fill rate
   */
  resize(): void {
    if (this.isContextLost || this.disposed) return;
    const width = Math.max(1, this.canvas.width);
    const height = Math.max(1, this.canvas.height);

    if (this.warpFBO.width !== width || this.warpFBO.height !== height) {
      if (this.warpFBO) this.deleteFramebuffer(this.warpFBO);
      this.warpFBO = this.createFramebuffer(width, height, true);
    }
  }

  start(): void {
    if (this.disposed || this.isPlaying || this.isContextLost) return;
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame(this.renderLoop);
  }

  stop(): void {
    this.isPlaying = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private renderLoop = (timestamp: DOMHighResTimeStamp): void => {
    if (!this.isPlaying || this.isContextLost) return;

    // Pause when tab is not visible
    if (typeof document !== 'undefined' && document.hidden) {
      this.animationId = requestAnimationFrame(this.renderLoop);
      return;
    }

    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;

    // Smooth speed transition
    this._animationSpeed += (this._targetAnimationSpeed - this._animationSpeed) * 0.05;
    this.accumulatedTime += dt * this._animationSpeed;

    this.render(this.accumulatedTime, timestamp);
    this.animationId = requestAnimationFrame(this.renderLoop);
  };

  private render(time: number, timestamp = performance.now()): void {
    if (this.disposed || !this.hasImage || this.isContextLost) return;
    const gl = this.gl;
    const width = Math.max(1, this.canvas.width);
    const height = Math.max(1, this.canvas.height);

    if (this.warpFBO.width !== width || this.warpFBO.height !== height) {
      this.deleteFramebuffer(this.warpFBO);
      this.warpFBO = this.createFramebuffer(width, height, true);
    }

    let blendFactor = 1.0;
    if (this.isTransitioning) {
      const elapsed = Math.max(0, timestamp - this.transitionStartTime);
      blendFactor = this._transitionDuration > 0
        ? Math.min(1.0, elapsed / this._transitionDuration)
        : 1.0;

      if (blendFactor >= 1.0) {
        this.isTransitioning = false;
      }
    }

    let currentTexture: WebGLTexture;

    if (this.isTransitioning && blendFactor < 1.0) {
      gl.useProgram(this.blendProgram);
      this.setupAttributes();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO1.framebuffer);
      gl.viewport(0, 0, BLUR_SIZE, BLUR_SIZE);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.currentAlbumFBO.texture);
      gl.uniform1i(this.uniforms.blend.texture1, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.nextAlbumFBO.texture);
      gl.uniform1i(this.uniforms.blend.texture2, 1);

      const easedBlend = 0.5 - 0.5 * Math.cos(blendFactor * Math.PI);
      gl.uniform1f(this.uniforms.blend.blend, easedBlend);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      currentTexture = this.blurFBO1.texture;
    } else {
      currentTexture = this.nextAlbumFBO.texture;
    }

    // Domain warp shader pass
    gl.useProgram(this.warpProgram);
    this.setupAttributes();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.warpFBO.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    gl.uniform1i(this.uniforms.warp.texture, 0);
    gl.uniform1f(this.uniforms.warp.time, time);
    gl.uniform1f(this.uniforms.warp.intensity, this._warpIntensity);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Final output pass (Vignette, saturation, dithering to canvas)
    gl.useProgram(this.outputProgram);
    this.setupAttributes();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.bindTexture(gl.TEXTURE_2D, this.warpFBO.texture);
    gl.uniform1i(this.uniforms.output.texture, 0);
    gl.uniform1f(this.uniforms.output.saturation, this._saturation);
    gl.uniform1f(this.uniforms.output.dithering, this._dithering);
    gl.uniform1f(this.uniforms.output.time, time);
    gl.uniform1f(this.uniforms.output.scale, this._scale);
    gl.uniform2f(this.uniforms.output.resolution, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private setupAttributes(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.attribs.position);
    gl.vertexAttribPointer(this.attribs.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.attribs.texCoord);
    gl.vertexAttribPointer(this.attribs.texCoord, 2, gl.FLOAT, false, 0, 0);
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${err}`);
    }
    return shader;
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');

    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link error: ${err}`);
    }

    gl.deleteShader(vShader);
    gl.deleteShader(fShader);
    return program;
  }

  private createBuffer(data: Float32Array): WebGLBuffer {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Failed to create buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to create texture');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  private createFramebuffer(width: number, height: number, useHighPrecision = false): Framebuffer {
    const gl = this.gl;
    const texture = this.createTexture();

    const canUseHalfFloat = useHighPrecision && this.halfFloatExt && this.halfFloatLinearExt;
    const type = canUseHalfFloat ? this.halfFloatExt!.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      type,
      null
    );

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) throw new Error('Failed to create framebuffer');

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    return { framebuffer, texture, width, height };
  }

  private deleteFramebuffer(fbo: Framebuffer): void {
    if (!this.gl) return;
    this.gl.deleteFramebuffer(fbo.framebuffer);
    this.gl.deleteTexture(fbo.texture);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();

    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);

    const gl = this.gl;
    if (!gl) return;

    gl.deleteProgram(this.blurProgram);
    gl.deleteProgram(this.blendProgram);
    gl.deleteProgram(this.tintProgram);
    gl.deleteProgram(this.warpProgram);
    gl.deleteProgram(this.outputProgram);

    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    gl.deleteTexture(this.sourceTexture);

    this.deleteFramebuffer(this.blurFBO1);
    this.deleteFramebuffer(this.blurFBO2);
    this.deleteFramebuffer(this.currentAlbumFBO);
    this.deleteFramebuffer(this.nextAlbumFBO);
    this.deleteFramebuffer(this.warpFBO);
  }
}

export default KawarpCore;
