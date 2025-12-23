export const vertexShaderSource = `
attribute vec2 a_position; // Vertex position on circle
attribute vec2 a_pathCenter; // Center of the circular cross-section
attribute float a_alongPath; // 0.0 (tail) to 1.0 (head)
attribute float a_radiusOffset; // 1.0 at edge
attribute float a_coneType; // 0.0 = white inner, 1.0 = yellow outer

uniform vec2 u_resolution;
uniform float u_devicePixelRatio;
uniform float u_whiteRadiusRatio;
uniform float u_yellowRadiusRatio;
uniform float u_glowRadius;
uniform float u_headRadius;
uniform float u_tailRadius;
uniform float u_pathLength;

varying vec2 v_position;
varying float v_radiusOffset;
varying float v_alongPath;
varying float v_coneType;
varying vec3 v_color;

void main() {
    // a_position already contains the final vertex position (calculated in JS)
    vec2 positionInDevicePixels = a_position * u_devicePixelRatio;
    vec2 clipSpace = ((positionInDevicePixels / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
    
    gl_Position = vec4(clipSpace, 0, 1);
    
    v_position = a_position;
    v_pathCenter = a_pathCenter;
    v_alongPath = a_alongPath;
    v_coneType = a_coneType;
    
    // Set color based on cone type
    if (a_coneType < 0.5) {
        v_color = vec3(1.0, 1.0, 1.0); // White
    } else {
        v_color = vec3(0.996, 0.996, 0.318); // #FEFE51 yellow
    }
}`;

export const fragmentShaderSource = `
precision highp float;

varying vec2 v_position;
varying float v_radiusOffset;
varying float v_alongPath;
varying float v_coneType;
varying vec3 v_color;

uniform float u_whiteRadiusRatio;
uniform float u_yellowRadiusRatio;
uniform float u_glowRadius;
uniform float u_headRadius;
uniform float u_tailRadius;

void main() {
    vec3 finalColor = v_color;
    
    // Calculate distance from path center
    vec2 toCenter = v_position - v_pathCenter;
    float distFromCenterPixels = length(toCenter);
    
    // Calculate current radius at this point along path
    float currentRadius = u_tailRadius + (u_headRadius - u_tailRadius) * v_alongPath;
    
    if (v_coneType < 0.5) {
        // White inner cone
        float whiteRadius = currentRadius * u_whiteRadiusRatio;
        float distNorm = distFromCenterPixels / whiteRadius;
        
        if (distNorm > 1.0) {
            discard;
        }
        // Smooth edges with anti-aliasing
        float edgeFade = 1.0 - smoothstep(0.85, 1.0, distNorm);
        gl_FragColor = vec4(finalColor, edgeFade);
    } else {
        // Yellow outer cone
        float whiteRadius = currentRadius * u_whiteRadiusRatio;
        float yellowRadius = currentRadius * (u_whiteRadiusRatio + u_yellowRadiusRatio);
        float glowRadius = yellowRadius + u_glowRadius;
        
        if (distFromCenterPixels <= whiteRadius) {
            // Inside white area, don't render (white cone handles this)
            discard;
        } else if (distFromCenterPixels <= yellowRadius) {
            // Yellow stroke area
            float t = (distFromCenterPixels - whiteRadius) / (yellowRadius - whiteRadius);
            float edgeFade = 1.0 - smoothstep(0.9, 1.0, t);
            gl_FragColor = vec4(finalColor, edgeFade);
        } else if (distFromCenterPixels <= glowRadius) {
            // Glow area
            float t = (distFromCenterPixels - yellowRadius) / (glowRadius - yellowRadius);
            float glowAlpha = (1.0 - t) * (1.0 - t); // Quadratic fade
            gl_FragColor = vec4(finalColor, glowAlpha * 0.7);
        } else {
            discard;
        }
    }
}`;
