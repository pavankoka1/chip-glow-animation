export const vertexShaderSource = `
attribute vec2 a_position;
attribute float a_radius;
attribute vec3 a_sparkColor;
attribute float a_alpha;
attribute float a_along01;
attribute float a_glowRadius;
uniform vec2 u_resolution;
uniform float u_devicePixelRatio;
uniform float u_whiteCenterRatio;

varying vec2 v_position;
varying float v_radius;
varying vec3 v_sparkColor;
varying float v_alpha;
varying float v_whiteCenterRatio;
varying float v_along01;
varying float v_glowRadius;

void main() {
  vec2 positionInDevicePixels = a_position * u_devicePixelRatio;
  vec2 clipSpace = ((positionInDevicePixels / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
  gl_Position = vec4(clipSpace, 0, 1);
  
  // Include glow radius in point size
  gl_PointSize = (a_radius + a_glowRadius) * 2.0 * u_devicePixelRatio;
  
  v_position = a_position;
  v_radius = a_radius;
  v_sparkColor = a_sparkColor;
  v_alpha = a_alpha;
  v_whiteCenterRatio = u_whiteCenterRatio;
  v_along01 = a_along01;
  v_glowRadius = a_glowRadius;
}`;

export const fragmentShaderSource = `
precision highp float;

varying vec2 v_position;
varying float v_radius;
varying vec3 v_sparkColor;
varying float v_alpha;
varying float v_whiteCenterRatio;
varying float v_along01;
varying float v_glowRadius;

uniform float u_glowOpacity;
uniform float u_whiteCoverage;
uniform float u_headTaperRatio;
uniform float u_headCurve;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
  float dist = length(coord) * 2.0;
  
  float totalRadius = v_radius + v_glowRadius;
  if (totalRadius <= 0.0) discard;
  
  // Normalize distance relative to total radius (including glow)
  float distNorm = dist;
  float coreRadiusNorm = v_radius / totalRadius;
  
  if (distNorm > 1.0) discard;
  
  // Horizontal split: white in middle (Y between -0.5 and 0.5), yellow on top/bottom
  // coord.y ranges from -0.5 to 0.5 (bottom to top)
  // whiteCenterRatio: 0.5 means white takes 50% of the vertical space
  float whiteHeightNorm = clamp(v_whiteCenterRatio, 0.0, 1.0);
  float baseWhiteHalfHeight = whiteHeightNorm * 0.5; // Base half height of white band
  
  // White coverage: controls how much of the total length white covers (0.0 to 1.0)
  // whiteCoverage: 1.0 = 100% coverage (full length), 0.5 = 50% coverage (half length, centered)
  float whiteCoverageNorm = clamp(u_whiteCoverage, 0.0, 1.0);
  
  // Calculate white coverage region (centered)
  // If coverage is 100%, white spans from 0.0 to 1.0
  // If coverage is 50%, white spans from 0.25 to 0.75 (centered)
  float whiteStart = (1.0 - whiteCoverageNorm) * 0.5;
  float whiteEnd = whiteStart + whiteCoverageNorm;
  
  // Check if current position is within white coverage region
  bool inWhiteCoverageRegion = (v_along01 >= whiteStart && v_along01 <= whiteEnd);
  
  // Calculate head taper effect for the actual spark head
  // This applies to both the dot radius and white center at the spark's head
  float headTaperEffect = 1.0;
  if (u_headTaperRatio > 0.0 && v_along01 > 1.0 - u_headTaperRatio) {
    // In the head taper region - create rounded/curved edge
    float headT = (v_along01 - (1.0 - u_headTaperRatio)) / u_headTaperRatio;
    // Base smoothness using cosine (matches JavaScript calculation)
    float baseSmoothness = cos(headT * 3.14159 / 2.0);
    
    // Apply head curve to smooth the head more (matches JavaScript)
    // headCurve: 0.0 = no extra smoothing, 1.0 = maximum smoothing
    if (u_headCurve > 0.0) {
      // Use power function to create smoother curve (matches JavaScript)
      float curvePower = 1.0 + u_headCurve * 2.0; // 1.0 to 3.0
      headTaperEffect = pow(baseSmoothness, 1.0 / curvePower);
    } else {
      headTaperEffect = baseSmoothness;
    }
    headTaperEffect = max(headTaperEffect, 0.0);
  }
  
  // Apply head taper and curve to white height
  // This makes white center follow the smoothed head shape
  float whiteHalfHeight = baseWhiteHalfHeight * headTaperEffect;
  
  // Only show white if we're in the white coverage region
  if (!inWhiteCoverageRegion) {
    whiteHalfHeight = 0.0; // No white outside coverage region
  }
  
  vec3 finalColor;
  float finalAlpha = v_alpha;
  
  if (distNorm <= coreRadiusNorm) {
    // Inside core radius
    // Only render white if whiteHalfHeight is greater than a small threshold
    if (whiteHalfHeight > 0.001 && abs(coord.y) <= whiteHalfHeight) {
      // White middle band (horizontal stripe) - completely removed at edges, not faded
      finalColor = vec3(1.0, 1.0, 1.0);
      finalAlpha = v_alpha;
    } else {
      // Yellow top and bottom (2nd layer color) - fills the rest when white is removed
      finalColor = v_sparkColor;
      finalAlpha = v_alpha;
    }
    
    // Smooth circular edge
    float edgeFadeDist = smoothstep(coreRadiusNorm * 0.9, coreRadiusNorm, distNorm);
    finalAlpha *= (1.0 - edgeFadeDist * 0.3); // Slight fade at core edge
  } else if (v_glowRadius > 0.0 && distNorm <= 1.0) {
    // Glow region (outside core, inside glow radius)
    float glowDist = (distNorm - coreRadiusNorm) / (1.0 - coreRadiusNorm);
    glowDist = clamp(glowDist, 0.0, 1.0);
    
    // Glow fades from glowOpacity at core edge to 0 at glow edge
    float glowAlpha = u_glowOpacity * (1.0 - glowDist);
    
    finalColor = v_sparkColor;
    finalAlpha = glowAlpha;
  } else {
    discard;
  }
  
  // Additional smooth edge for head (smooth tip)
  // This creates a smoother transition at the head
  float headSmoothness = 1.0;
  if (v_along01 > 0.9) {
    // Last 10% of spark - extra smoothness
    float headT = (v_along01 - 0.9) / 0.1;
    headSmoothness = smoothstep(0.0, 1.0, 1.0 - headT * 0.5);
  }
  finalAlpha *= headSmoothness;
  
  gl_FragColor = vec4(finalColor, finalAlpha);
}`;

