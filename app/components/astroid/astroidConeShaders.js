export const vertexShaderSource = `
attribute vec3 a_position;
attribute float a_coneType;

uniform vec2 u_resolution;
uniform float u_devicePixelRatio;
uniform float u_scale;
uniform float u_baseRadius;
uniform float u_height;
uniform float u_whiteRadiusRatio;
uniform float u_yellowRadiusRatio;
uniform float u_rotateX;
uniform float u_rotateY;
uniform float u_rotateZ;
uniform float u_bendAngle;
uniform vec2 u_positionOffset; // Screen position offset

varying vec3 v_position;
varying float v_coneType;

mat3 rotateX(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}

mat3 rotateY(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        c, 0.0, s,
        0.0, 1.0, 0.0,
        -s, 0.0, c
    );
}

mat3 rotateZ(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        c, -s, 0.0,
        s, c, 0.0,
        0.0, 0.0, 1.0
    );
}

void main() {
    vec3 bentPosition = a_position;
    if (abs(u_bendAngle) > 0.001) {
        float bendRadius = u_height / u_bendAngle;
        float zNormalized = a_position.z / u_height;
        float bendTheta = zNormalized * u_bendAngle;
        float cosBend = cos(bendTheta);
        float sinBend = sin(bendTheta);
        float newY = bentPosition.y + bendRadius * (1.0 - cosBend);
        float newZ = bendRadius * sinBend;
        bentPosition = vec3(bentPosition.x, newY, newZ);
    }
    
    mat3 rotationMatrix = rotateZ(u_rotateZ) * rotateY(u_rotateY) * rotateX(u_rotateX);
    vec3 rotatedPosition = rotationMatrix * bentPosition;
    vec3 scaledPosition = rotatedPosition * u_scale;
    
    float centerOffsetZ = (u_height * u_scale) * 0.5;
    float flippedZ = u_height * u_scale - scaledPosition.z;
    vec2 screenPos = vec2(
        flippedZ - centerOffsetZ,
        scaledPosition.y
    );
    
    // Center in screen space (convert resolution from device pixels to screen coordinates)
    vec2 screenResolution = u_resolution / u_devicePixelRatio;
    screenPos += screenResolution * 0.5;
    
    // Apply position offset (in screen coordinates, will be multiplied by DPR)
    screenPos += u_positionOffset;
    
    // Convert to clip space
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
uniform float u_glowRadius;
uniform float u_glowSpread;
uniform vec3 u_glowColor;

void main() {
    float yellowHemisphereRadius = u_baseRadius * (u_whiteRadiusRatio + u_yellowRadiusRatio);
    float maxHemisphereRadius = yellowHemisphereRadius;
    float minPossibleZ = u_height - maxHemisphereRadius - 200.0;
    float maxPossibleZ = u_height + maxHemisphereRadius + 50.0;
    bool isHemisphere = (v_position.z > u_height + 0.01 || v_position.z < -0.1) &&
                        v_position.z >= minPossibleZ && v_position.z <= maxPossibleZ;
    
    float distFromCenter;
    float yellowRadius;
    float whiteRadius;
    vec3 baseColor;
    float finalAlpha = 1.0;
    
    if (isHemisphere) {
        distFromCenter = length(v_position.xy);
        
        if (v_coneType < 0.5) {
            baseColor = vec3(1.0, 1.0, 1.0);
            float whiteHemisphereRadius = u_baseRadius * u_whiteRadiusRatio;
            float baseZ = u_height;
            float zRelative = v_position.z - baseZ;
            float cosPhi = -zRelative / whiteHemisphereRadius;
            cosPhi = clamp(cosPhi, 0.0, 1.0);
            float sinPhi = sqrt(1.0 - cosPhi * cosPhi);
            whiteRadius = whiteHemisphereRadius * sinPhi;
            yellowRadius = whiteRadius;
        } else if (v_coneType < 1.5) {
            float whiteHemisphereRadius = u_baseRadius * u_whiteRadiusRatio;
            float yellowHemisphereRadius = u_baseRadius * (u_whiteRadiusRatio + u_yellowRadiusRatio);
            float baseZ = u_height;
            float zRelative = v_position.z - baseZ;
            float cosPhi = -zRelative / whiteHemisphereRadius;
            cosPhi = clamp(cosPhi, 0.0, 1.0);
            float sinPhi = sqrt(1.0 - cosPhi * cosPhi);
            whiteRadius = whiteHemisphereRadius * sinPhi;
            yellowRadius = yellowHemisphereRadius * sinPhi;
            
            float yellowStart = whiteRadius * 0.75;
            if (distFromCenter < yellowStart) {
                discard;
            }
            baseColor = vec3(0.996, 0.996, 0.318);
        }
    } else {
        distFromCenter = abs(v_position.y);
        float u = v_position.z / u_height;
        float currentRadius = u_baseRadius * (1.0 - u);
        
        if (v_coneType < 0.5) {
            whiteRadius = currentRadius * u_whiteRadiusRatio;
            if (distFromCenter > whiteRadius * 1.01) {
                discard;
            }
            baseColor = vec3(1.0, 1.0, 1.0);
            yellowRadius = whiteRadius;
        } else if (v_coneType < 1.5) {
            yellowRadius = currentRadius * (u_whiteRadiusRatio + u_yellowRadiusRatio);
            whiteRadius = currentRadius * u_whiteRadiusRatio;
            
            float yellowStart = whiteRadius * 0.75;
            
            if (distFromCenter < yellowStart) {
                discard;
            }
            baseColor = vec3(0.996, 0.996, 0.318);
        }
    }
    
    float glowIntensity = 0.0;
    
    if (v_coneType < 1.5) {
        float outerRadius = yellowRadius;
        float distFromEdge = outerRadius - distFromCenter;
        
        if (distFromEdge < u_glowRadius && distFromEdge > -u_glowRadius) {
            float t = abs(distFromEdge) / u_glowRadius;
            t = clamp(t, 0.0, 1.0);
            glowIntensity = 0.2 * (1.0 - t);
            glowIntensity *= exp(-t * t * u_glowSpread);
        }
    }
    
    vec3 finalColor = mix(baseColor, u_glowColor, glowIntensity);
    
    gl_FragColor = vec4(finalColor, finalAlpha);
}`;

