export const vertexShaderSource = `
attribute vec2 a_position;
attribute float a_radius;
attribute vec3 a_sparkColor;
attribute vec3 a_glowColor;
attribute float a_alpha;
attribute float a_glowRadius;
uniform vec2 u_resolution;
uniform float u_devicePixelRatio;
uniform float u_whiteCenterRatio;
uniform float u_glowOpacityStart;
uniform float u_glowSideSuppression;
varying vec2 v_position;
varying float v_radius;
varying vec3 v_sparkColor;
varying vec3 v_glowColor;
varying float v_alpha;
varying float v_glowRadius;
varying float v_whiteCenterRatio;
varying float v_glowOpacityStart;
varying float v_glowSideSuppression;
void main(){
vec2 positionInDevicePixels=a_position*u_devicePixelRatio;
vec2 clipSpace=((positionInDevicePixels/u_resolution)*2.0-1.0)*vec2(1,-1);
gl_Position=vec4(clipSpace,0,1);
gl_PointSize=(a_radius+a_glowRadius)*2.0*u_devicePixelRatio;
v_position=a_position;
v_radius=a_radius;
v_sparkColor=a_sparkColor;
v_glowColor=a_glowColor;
v_alpha=a_alpha;
v_glowRadius=a_glowRadius;
v_whiteCenterRatio=u_whiteCenterRatio;
v_glowOpacityStart=u_glowOpacityStart;
v_glowSideSuppression=u_glowSideSuppression;
}`;

export const fragmentShaderSource = `
precision highp float;
varying vec2 v_position;
varying float v_radius;
varying vec3 v_sparkColor;
varying vec3 v_glowColor;
varying float v_alpha;
varying float v_glowRadius;
varying float v_whiteCenterRatio;
varying float v_glowOpacityStart;
varying float v_glowSideSuppression;
void main(){
vec2 coord=gl_PointCoord-vec2(0.5,0.5);
float dist=length(coord)*2.0;
if(dist>1.0)discard;
float totalRadius=v_radius+v_glowRadius;
if(totalRadius<=0.0)discard;

// 3-layer structure:
// Layer 1: White center (configurable % of core radius)
// Layer 2: Yellow middle (remaining % of core radius) - Top/Bottom only
// Layer 3: Yellow glow (from core to glow radius) - Top/Bottom only
float coreOuterRadiusNorm=v_radius/totalRadius; // Normalized core radius
float whiteCenterRatio=clamp(v_whiteCenterRatio,0.0,1.0); // Clamp to valid range
float coreInnerRadiusNorm=coreOuterRadiusNorm*whiteCenterRatio; // White center size
float glowOuterRadiusNorm=1.0; // Glow extends to edge
float glowOpacityStart=clamp(v_glowOpacityStart,0.0,1.0); // Clamp to valid range

// Use coordinate to determine if we are in "top/bottom" or "sides"
// coord.x is horizontal (-0.5 to 0.5), coord.y is vertical (-0.5 to 0.5)
// We want to suppress yellow/glow on the sides (where abs(coord.x) is large relative to core)
float horizontalDistance = abs(coord.x) * 2.0; // 0 to 1.0
float verticalDistance = abs(coord.y) * 2.0; // 0 to 1.0

// Weighting factor to suppress sides: 1.0 at center line, 0.0 at sides
// We use a power function to make the transition sharper
float suppressionWidth = coreOuterRadiusNorm * clamp(v_glowSideSuppression, 0.1, 5.0);
float sideSuppression = pow(clamp(1.0 - horizontalDistance / suppressionWidth, 0.0, 1.0), 2.0);

vec4 color=vec4(0.0);

// Layer 1: Pure White center (always a circle, no gradient)
if(dist<=coreInnerRadiusNorm){
  color=vec4(v_sparkColor, 1.0); // Force alpha to 1.0 for pure white
}
// Layer 2: Pure Yellow middle (between white center and core edge) - Top/Bottom only
else if(dist<=coreOuterRadiusNorm){
  // Sharp cutoff for yellow middle as well, but with side suppression
  color=vec4(v_glowColor, 1.0 * sideSuppression);
}
// Layer 3: Yellow glow with gradient - Restricted to top/bottom
else if(dist<=glowOuterRadiusNorm && v_glowRadius>0.0){
  // Calculate glow gradient: starts at glowOpacityStart near core, fades to 0% at edge
  float glowDist=(dist-coreOuterRadiusNorm)/(glowOuterRadiusNorm-coreOuterRadiusNorm);
  glowDist=clamp(glowDist,0.0,1.0);
  // Linear fade from glowOpacityStart to 0.0
  float glowAlpha=glowOpacityStart*(1.0-glowDist);
  
  // Apply side suppression to glow as well
  color=vec4(v_glowColor, glowAlpha * sideSuppression);
}

gl_FragColor=color;
}`;
