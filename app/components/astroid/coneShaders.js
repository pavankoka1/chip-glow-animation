// Simple shaders for white and yellow cones (no glow, no tip)

export const vertexShaderSource = `
attribute vec3 a_position; // x, y, z coordinates (from parametric equations)
attribute float a_coneType; // 0.0 = white, 1.0 = yellow

uniform vec2 u_resolution;
uniform float u_devicePixelRatio;
uniform float u_scale;
uniform float u_baseRadius;
uniform float u_height;
uniform float u_whiteRadiusRatio;
uniform float u_yellowRadiusRatio;

varying vec3 v_position;
varying float v_coneType;

void main() {
    // For a side view of the cone:
    // - z (height) maps to screen x (horizontal, left to right)
    // - y (vertical in 3D space) maps to screen y (vertical)
    // - x (depth) is perpendicular to view, so we can use it for slight perspective or ignore
    
    // Scale the position
    vec3 scaledPosition = a_position * u_scale;
    
    // Project 3D to 2D: z -> x, y -> y
    // Center the cone at the screen center
    // Flip z coordinate to rotate 180deg: base (z=height) maps to left, apex (z=0) maps to right
    float centerOffsetZ = (u_height * u_scale) * 0.5;
    float flippedZ = u_height * u_scale - scaledPosition.z; // Flip: height*scale - z
    vec2 screenPos = vec2(
        flippedZ - centerOffsetZ + u_resolution.x * 0.5,  // Flipped z -> screen x, centered
        scaledPosition.y + u_resolution.y * 0.5   // y (vertical) -> screen y, centered
    );
    
    vec2 positionInDevicePixels = screenPos * u_devicePixelRatio;
    vec2 clipSpace = ((positionInDevicePixels / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
    
    gl_Position = vec4(clipSpace, 0, 1);
    
    v_position = a_position;
    v_coneType = a_coneType;
}`;

export const fragmentShaderSource = `
precision highp float;

varying vec3 v_position;
varying float v_coneType;

uniform float u_baseRadius;
uniform float u_height;
uniform float u_whiteRadiusRatio;
uniform float u_yellowRadiusRatio;

void main() {
    // Check if this is a hemisphere or cone
    // Hemispheres extend from base: z = height - r * cos(φ) + offset
    // With offset, z can range from height+offset-r to height+offset
    // Cones extend from z = 0 to z = height
    // Make detection flexible: hemisphere if z is outside cone range or in extended range
    float maxHemisphereRadius = u_baseRadius * (u_whiteRadiusRatio + u_yellowRadiusRatio);
    // Hemisphere detection: check if z is outside the cone range (0 to height)
    // or if it's in a range that could be a hemisphere with offset
    // Allow for offset range: -200 to +50
    float minPossibleZ = u_height - maxHemisphereRadius - 200.0;
    float maxPossibleZ = u_height + maxHemisphereRadius + 50.0;
    // Hemisphere if z is outside cone range (z > height or z < 0) 
    // AND within possible hemisphere range
    bool isHemisphere = (v_position.z > u_height + 0.01 || v_position.z < -0.1) &&
                        v_position.z >= minPossibleZ && v_position.z <= maxPossibleZ;
    
    if (isHemisphere) {
        // For hemisphere: calculate distance from center in xy plane
        float distFromCenter = length(v_position.xy);
        
        if (v_coneType < 0.5) {
            // White hemisphere - just render white (geometry already defines the surface)
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White
        } else {
            // Yellow hemisphere - exclude white area
            // For hemisphere, distFromCenter = r * sin(φ) where r is the hemisphere radius
            // We need to check if this point is within the white hemisphere at the same z
            float whiteHemisphereRadius = u_baseRadius * u_whiteRadiusRatio;
            float yellowHemisphereRadius = u_baseRadius * (u_whiteRadiusRatio + u_yellowRadiusRatio);
            
            // Calculate what the white hemisphere radius would be at this z position
            // z = height - whiteRadius*cos(φ) - 73.8, so cos(φ) = (height - z - 73.8) / whiteRadius
            float baseZ = u_height - 73.8;
            float zRelative = v_position.z - baseZ; // Should be negative (z < baseZ)
            float cosPhi = -zRelative / whiteHemisphereRadius; // cos(φ) from 0 to 1
            cosPhi = clamp(cosPhi, 0.0, 1.0);
            float sinPhi = sqrt(1.0 - cosPhi * cosPhi);
            float whiteRadiusAtZ = whiteHemisphereRadius * sinPhi;
            
            // Yellow starts at 75% of white radius at this z position
            float yellowStart = whiteRadiusAtZ * 0.75;
            if (distFromCenter < yellowStart) {
                discard; // Inside white area
            }
            gl_FragColor = vec4(0.996, 0.996, 0.318, 1.0); // Yellow #FEFE51
        }
    } else {
        // For cone: use y-axis distance (side view cross-section)
        float distFromCenter = abs(v_position.y);
        
        // Calculate radius at current height (u = z / height)
        float u = v_position.z / u_height;
        float currentRadius = u_baseRadius * (1.0 - u);
        
        if (v_coneType < 0.5) {
            // White inner cone
            float whiteRadius = currentRadius * u_whiteRadiusRatio;
            if (distFromCenter > whiteRadius * 1.01) {
                discard;
            }
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White
        } else {
            // Yellow outer cone
            float yellowRadius = currentRadius * (u_whiteRadiusRatio + u_yellowRadiusRatio);
            float whiteRadius = currentRadius * u_whiteRadiusRatio;
            
            // Yellow starts at 75% of white radius (overlap to prevent gaps)
            float yellowStart = whiteRadius * 0.75;
            
            if (distFromCenter < yellowStart) {
                discard; // Inside white area
            }
            if (distFromCenter > yellowRadius * 1.01) {
                discard; // Outside yellow area
            }
            gl_FragColor = vec4(0.996, 0.996, 0.318, 1.0); // Yellow #FEFE51
        }
    }
}`;
