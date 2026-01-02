export const vertexShaderSource = `
attribute vec2 a_position;
attribute float a_baseRadius;
attribute float a_height;
attribute float a_whiteRadiusRatio;
attribute float a_yellowRadiusRatio;
attribute float a_rotation;
attribute vec3 a_color;
attribute float a_alpha;

uniform vec2 u_resolution;
uniform float u_devicePixelRatio;

varying vec2 v_position;
varying float v_baseRadius;
varying float v_height;
varying float v_whiteRadiusRatio;
varying float v_yellowRadiusRatio;
varying float v_rotation;
varying vec3 v_color;
varying float v_alpha;

void main() {
  vec2 positionInDevicePixels = a_position * u_devicePixelRatio;
  vec2 clipSpace = ((positionInDevicePixels / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
  gl_Position = vec4(clipSpace, 0, 1);
  
  // Use point size based on astroid dimensions
  float maxRadius = a_baseRadius * (a_whiteRadiusRatio + a_yellowRadiusRatio);
  gl_PointSize = maxRadius * 2.0 * u_devicePixelRatio;
  
  v_position = a_position;
  v_baseRadius = a_baseRadius;
  v_height = a_height;
  v_whiteRadiusRatio = a_whiteRadiusRatio;
  v_yellowRadiusRatio = a_yellowRadiusRatio;
  v_rotation = a_rotation;
  v_color = a_color;
  v_alpha = a_alpha;
}`;

export const fragmentShaderSource = `
precision highp float;

varying vec2 v_position;
varying float v_baseRadius;
varying float v_height;
varying float v_whiteRadiusRatio;
varying float v_yellowRadiusRatio;
varying float v_rotation;
varying vec3 v_color;
varying float v_alpha;

uniform vec2 u_resolution;
uniform float u_glowRadius;
uniform float u_glowSpread;
uniform vec3 u_glowColor;

void main() {
  // Get coordinates relative to point center
  vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
  float dist = length(coord) * 2.0;
  
  if (dist > 1.0) discard;
  
  // Calculate radii
  float whiteRadius = v_baseRadius * v_whiteRadiusRatio;
  float yellowRadius = v_baseRadius * (v_whiteRadiusRatio + v_yellowRadiusRatio);
  float maxRadius = yellowRadius;
  
  // Normalize distances
  float distNorm = dist * maxRadius;
  
  vec3 finalColor = vec3(0.0);
  float finalAlpha = 0.0;
  
  // White center
  if (distNorm <= whiteRadius) {
    finalColor = vec3(1.0, 1.0, 1.0);
    finalAlpha = v_alpha;
  }
  // Yellow middle
  else if (distNorm <= yellowRadius) {
    finalColor = v_color;
    finalAlpha = v_alpha;
  }
  // Glow
  else if (distNorm <= maxRadius + u_glowRadius) {
    float glowDist = (distNorm - yellowRadius) / u_glowRadius;
    glowDist = clamp(glowDist, 0.0, 1.0);
    float glowAlpha = 0.3 * (1.0 - glowDist) * v_alpha;
    glowAlpha *= exp(-glowDist * glowDist * u_glowSpread);
    finalColor = mix(v_color, u_glowColor, 0.5);
    finalAlpha = glowAlpha;
  } else {
    discard;
  }
  
  gl_FragColor = vec4(finalColor, finalAlpha);
}`;





