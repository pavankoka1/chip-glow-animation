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
varying vec2 v_position;
varying float v_radius;
varying vec3 v_sparkColor;
varying vec3 v_glowColor;
varying float v_alpha;
varying float v_glowRadius;
varying float v_whiteCenterRatio;

void main(){
    vec2 positionInDevicePixels = a_position * u_devicePixelRatio;
    vec2 clipSpace = ((positionInDevicePixels / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
    gl_Position = vec4(clipSpace, 0, 1);
    
    // Total size includes the glow
    gl_PointSize = (a_radius + a_glowRadius) * 2.0 * u_devicePixelRatio;
    
    v_position = a_position;
    v_radius = a_radius;
    v_sparkColor = a_sparkColor;
    v_glowColor = a_glowColor;
    v_alpha = a_alpha;
    v_glowRadius = a_glowRadius;
    v_whiteCenterRatio = u_whiteCenterRatio;
}`;

export const fragmentShaderSource = `
precision highp float;
varying float v_radius;
varying vec3 v_sparkColor;
varying vec3 v_glowColor;
varying float v_alpha;
varying float v_glowRadius;
varying float v_whiteCenterRatio;

void main(){
    vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
    float dist = length(coord) * 2.0; // 0.0 at center, 1.0 at edge
    
    if (dist > 1.0) discard;

    float totalRadius = v_radius + v_glowRadius;
    if (totalRadius <= 0.0) discard;

    // Normalized boundaries
    float coreRadiusNorm = v_radius / totalRadius;
    float whiteRadiusNorm = coreRadiusNorm * v_whiteCenterRatio;
    
    vec4 finalColor = vec4(0.0);
    
    if (dist <= whiteRadiusNorm) {
        // Core: Solid White
        finalColor = vec4(v_sparkColor, v_alpha);
    } else if (dist <= coreRadiusNorm) {
        // Stroke: Solid Yellow
        finalColor = vec4(v_glowColor, v_alpha);
    } else {
        // Glow: Additive Yellow fading out
        float t = (dist - coreRadiusNorm) / (1.0 - coreRadiusNorm);
        float glowAlpha = v_alpha * (1.0 - t) * (1.0 - t); 
        finalColor = vec4(v_glowColor, glowAlpha);
    }

    gl_FragColor = finalColor;
}`;
