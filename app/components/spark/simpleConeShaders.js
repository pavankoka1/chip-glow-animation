export const vertexShaderSource = `
attribute vec2 a_position; // Path position (x, y along the spark path)
attribute float a_alongPath; // 0.0 (tail) to 1.0 (head)
attribute float a_radiusOffset; // -1.0 (bottom) to 1.0 (top) of cross-section
attribute float a_coneType; // 0.0 = white inner, 1.0 = yellow outer

uniform vec2 u_resolution;
uniform float u_devicePixelRatio;
uniform float u_whiteRadiusRatio;
uniform float u_yellowRadiusRatio;
uniform float u_glowRadius;
uniform float u_glowSpread;
uniform float u_headRadius;
uniform float u_tailRadius;
uniform float u_tipRadius;
uniform float u_tipWidth;
uniform float u_rotateX;
uniform float u_rotateY;
uniform float u_rotateZ;
uniform vec3 u_glowColor;

varying float v_alongPath;
varying float v_radiusOffset;
varying float v_coneType;
varying vec3 v_color;
varying float v_isHeadCap;

void main() {
    // Check if this is a head cap (a_alongPath > 1.0 indicates cap)
    float isHeadCap = step(1.0, a_alongPath);
    v_isHeadCap = isHeadCap;
    
    // Calculate radius at this point along the path
    float radius;
    if (isHeadCap > 0.5) {
        // Head cap: use headRadius, shader will scale by ratio
        // The cap geometry is generated with layer radius, but shader uses headRadius
        // and scales by ratio to get the correct final size
        radius = u_headRadius;
    } else {
        // Main body: tapering from tail to head
        radius = u_tailRadius + (u_headRadius - u_tailRadius) * a_alongPath;
    }
    
    // Determine which cone we're rendering
    float actualRadius;
    if (a_coneType < 0.5) {
        // White inner cone
        actualRadius = radius * u_whiteRadiusRatio;
    } else if (a_coneType < 1.5) {
        // Yellow outer cone
        actualRadius = radius * (u_whiteRadiusRatio + u_yellowRadiusRatio);
    } else {
        // Glow layer - extends beyond yellow
        actualRadius = radius * (u_whiteRadiusRatio + u_yellowRadiusRatio) + u_glowRadius;
    }
    
    // Create vertical cross-section (radius on Y axis)
    // a_radiusOffset: -1 (bottom) to 1 (top)
    vec2 offset = vec2(0.0, a_radiusOffset * actualRadius);
    
    // Apply rotation (X, Y, Z in degrees)
    // For 2D horizontal cone, we apply rotations to the vertical offset
    float rotX = u_rotateX * 3.14159 / 180.0;
    float rotY = u_rotateY * 3.14159 / 180.0;
    float rotZ = u_rotateZ * 3.14159 / 180.0;
    
    // X rotation: tilts the vertical cross-section (affects Y component)
    float cosX = cos(rotX);
    float sinX = sin(rotX);
    vec2 offsetX = vec2(
        offset.x + offset.y * sinX,
        offset.y * cosX
    );
    
    // Y rotation: tilts left/right (affects X component)
    float cosY = cos(rotY);
    float sinY = sin(rotY);
    vec2 offsetY = vec2(
        offsetX.x * cosY,
        offsetX.y + offsetX.x * sinY
    );
    
    // Z rotation: rotates in 2D plane
    float cosZ = cos(rotZ);
    float sinZ = sin(rotZ);
    vec2 rotated = vec2(
        offsetY.x * cosZ - offsetY.y * sinZ,
        offsetY.x * sinZ + offsetY.y * cosZ
    );
    
    // Final position
    vec2 finalPosition = a_position + rotated;
    vec2 positionInDevicePixels = finalPosition * u_devicePixelRatio;
    vec2 clipSpace = ((positionInDevicePixels / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
    
    gl_Position = vec4(clipSpace, 0, 1);
    
    v_alongPath = a_alongPath;
    v_radiusOffset = a_radiusOffset; // -1 to 1
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

varying float v_alongPath;
varying float v_radiusOffset;
varying float v_coneType;
varying vec3 v_color;
varying float v_isHeadCap;

uniform float u_whiteRadiusRatio;
uniform float u_yellowRadiusRatio;
uniform float u_glowRadius;
uniform float u_glowSpread;
uniform float u_headRadius;
uniform float u_tailRadius;
uniform float u_tipRadius;
uniform float u_tipWidth;
uniform vec3 u_glowColor;

void main() {
    vec3 finalColor = v_color;
    
    // Calculate current radius at this point along path
    float currentRadius;
    if (v_isHeadCap > 0.5) {
        // Head cap: simple hemisphere - constant radius (headRadius)
        // The cap is a semi-sphere, so radius is always headRadius
        currentRadius = u_headRadius;
    } else {
        // Main body
        currentRadius = u_tailRadius + (u_headRadius - u_tailRadius) * v_alongPath;
    }
    
    // Distance from center (0 to 1, where 1 is at the edge of THIS layer)
    // v_radiusOffset is -1 to 1, representing position in this layer's cross-section
    float distFromCenter = abs(v_radiusOffset);
    
    // Calculate all radii first
    float whiteRadius = currentRadius * u_whiteRadiusRatio;
    float yellowRadius = currentRadius * (u_whiteRadiusRatio + u_yellowRadiusRatio);
    float glowRadius = yellowRadius + u_glowRadius;
    
    if (v_coneType < 0.5) {
        // White inner cone
        // distFromCenter is relative to white radius (0-1 maps to 0-whiteRadius)
        float distPixels = distFromCenter * whiteRadius;
        
        // Main body and cap: sharp edge
        // Increased tolerance slightly to ensure edge vertices render and close the gap
        if (distPixels > whiteRadius * 1.02) {
            discard;
        }
        gl_FragColor = vec4(finalColor, 1.0);
    } else if (v_coneType < 1.5) {
        // Yellow outer cone
        // distFromCenter is relative to yellow radius (0-1 maps to 0-yellowRadius)
        float distPixels = distFromCenter * yellowRadius;
        
        if (v_isHeadCap > 0.5) {
            // For cap: render full yellow hemisphere (white will render on top)
            if (distPixels <= yellowRadius + 0.01) {
                gl_FragColor = vec4(finalColor, 1.0);
            } else {
                discard;
            }
        } else {
            // Main body: Yellow starts at 75% of white radius (large overlap to prevent gaps)
            float yellowStart = whiteRadius * 0.75;
            
            // At the very end (alongPath = 1.0), ensure yellow doesn't render too close to white edge
            // to prevent visible boundary line
            float adjustedYellowStart = yellowStart;
            if (v_alongPath > 0.99) {
                // Near the end, increase the yellow start threshold slightly to prevent boundary line
                adjustedYellowStart = whiteRadius * 0.80;
            }
            
            if (distPixels < adjustedYellowStart) {
                // Well inside white area, don't render
                discard;
            }
            
            // Increased tolerance slightly to ensure yellow cone renders properly at edges
            if (distPixels <= yellowRadius + 0.02) {
                // Yellow stroke area - fully opaque yellow
                gl_FragColor = vec4(finalColor, 1.0);
            } else {
                discard;
            }
        }
    } else {
        // Glow layer (coneType 2) - soft aura-like glow around the object
        // distFromCenter is relative to glow radius (0-1 maps to 0-glowRadius)
        float distPixels = distFromCenter * glowRadius;
        
        // Glow starts at 85% of yellow radius (large overlap to prevent gaps)
        float glowStart = yellowRadius * 0.85;
        
        if (distPixels < glowStart) {
            // Inside yellow area, don't render
            discard;
        } else if (distPixels <= glowRadius) {
            // Glow area - soft aura with smooth falloff
            float t = (distPixels - glowStart) / (glowRadius - glowStart);
            t = clamp(t, 0.0, 1.0);
            
            // Soft Gaussian-like falloff for aura effect
            float glowAlpha = exp(-t * t * u_glowSpread * 2.0);
            
            // Additional smooth fade for very soft edges
            glowAlpha *= smoothstep(1.0, 0.7, t);
            
            // Use yellow color (from config) with soft aura
            gl_FragColor = vec4(u_glowColor, glowAlpha);
        } else {
            discard;
        }
    }
}`;
