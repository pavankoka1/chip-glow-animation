/**
 * WebGL shader source code
 */

export const vertexShaderSource = `
  attribute vec2 a_position;
  attribute float a_radius;
  attribute vec3 a_sparkColor;
  attribute vec3 a_glowColor;
  attribute float a_alpha;
  attribute float a_glowRadius;
  
  uniform vec2 u_resolution;
  uniform float u_devicePixelRatio;
  
  varying vec2 v_position;
  varying float v_radius;
  varying vec3 v_sparkColor;
  varying vec3 v_glowColor;
  varying float v_alpha;
  varying float v_glowRadius;
  
  void main() {
    vec2 positionInDevicePixels = a_position * u_devicePixelRatio;
    vec2 clipSpace = ((positionInDevicePixels / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
    gl_Position = vec4(clipSpace, 0, 1);
    gl_PointSize = (a_radius + a_glowRadius) * 2.0 * u_devicePixelRatio;
    
    v_position = a_position;
    v_radius = a_radius;
    v_sparkColor = a_sparkColor;
    v_glowColor = a_glowColor;
    v_alpha = a_alpha;
    v_glowRadius = a_glowRadius;
  }
`;

export const fragmentShaderSource = `
  precision highp float;
  
  varying vec2 v_position;
  varying float v_radius;
  varying vec3 v_sparkColor;
  varying vec3 v_glowColor;
  varying float v_alpha;
  varying float v_glowRadius;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
    float dist = length(coord) * 2.0;
    
    if (dist > 1.0) {
      discard;
    }
    
    float totalRadius = v_radius + v_glowRadius;
    if (totalRadius <= 0.0) {
      discard;
    }
    
    // dist is normalized to [0, 1] where 1 = edge of point sprite (totalRadius)
    // So dist = 1.0 means we're at totalRadius pixels from center
    // dist = v_radius / totalRadius means we're at v_radius pixels from center
    float pointRadiusNorm = v_radius / totalRadius;
    
    // Core spark: always use sparkColor with full alpha (no fading)
    // In 2D canvas: ctx.fillStyle = rgba(r, g, b, alpha) where r,g,b come from sparkColor
    vec4 coreColor = vec4(v_sparkColor, v_alpha);
    vec4 color = vec4(0.0);
    
    // Draw core first (like 2D canvas does)
    if (dist <= pointRadiusNorm) {
      color = coreColor;
    }
    
    // Glow calculation (matches 2D canvas exactly)
    // In 2D: createRadialGradient(x, y, radius, x, y, totalRadius)
    // This creates a gradient where:
    // - t=0 is at radius (edge of core)
    // - t=1 is at totalRadius (edge of glow)
    // - The gradient is drawn as a full circle covering both core and glow areas
    if (v_glowRadius > 0.0) {
      // Calculate gradient parameter t: 0 = edge of core, 1 = edge of glow
      // dist: 0 = center, pointRadiusNorm = edge of core, 1.0 = edge of glow
      float glowT = 0.0;
      if (dist >= pointRadiusNorm) {
        // In glow zone: map from [pointRadiusNorm, 1.0] to [0, 1]
        glowT = (dist - pointRadiusNorm) / (1.0 - pointRadiusNorm);
      } else {
        // Inside core: t = 0 (gradient color at inner edge)
        glowT = 0.0;
      }
      
      // Clamp t to [0, 1]
      glowT = clamp(glowT, 0.0, 1.0);
      
      float maxAuraAlpha = v_alpha * 0.3;
      float auraAlpha;
      
      // High opacity zone: first 20% of glow radius (t <= 0.2)
      if (glowT <= 0.2) {
        float tInZone = glowT / 0.2;
        auraAlpha = maxAuraAlpha * (0.85 + 0.15 * (1.0 - tInZone));
      } else {
        // Fade zone: remaining 80% with exponential falloff
        float tInFadeZone = (glowT - 0.2) / 0.8;
        float falloff = pow(1.0 - tInFadeZone, 2.5);
        auraAlpha = maxAuraAlpha * falloff;
      }
      
      auraAlpha = min(auraAlpha, maxAuraAlpha);
      
      // Glow color (2D canvas uses auraAlpha * 0.5 for gradient stops)
      vec4 glowColor = vec4(v_glowColor, auraAlpha * 0.5);
      
      // Blend glow on top of core (like 2D canvas: second fill() blends on top of first)
      // Canvas uses source-over blending: result = source + (1 - source.a) * destination
      if (dist <= pointRadiusNorm) {
        // Inside core: blend glow on top
        color.rgb = mix(color.rgb, glowColor.rgb, glowColor.a);
        color.a = color.a + glowColor.a * (1.0 - color.a);
      } else {
        // In glow-only zone: just glow
        color = glowColor;
      }
    } else {
      // No glow: just core
      if (dist <= pointRadiusNorm) {
        color = coreColor;
      }
    }
    
    gl_FragColor = color;
  }
`;
