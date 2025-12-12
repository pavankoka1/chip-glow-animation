export const betspotVertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  
  uniform vec2 u_resolution;
  uniform vec2 u_center;
  uniform float u_scale;
  uniform float u_devicePixelRatio;
  uniform float u_glowSpread; // How far the glow extends beyond the object
  
  varying vec2 v_texCoord;
  varying vec2 v_worldCoord; // World coordinates for glow calculation
  
  void main() {
    // Scale the position
    vec2 scaledPosition = a_position * u_scale;
    
    // Translate to center
    vec2 centeredPosition = scaledPosition + u_center;
    
    // Store world coordinates for fragment shader
    v_worldCoord = centeredPosition;
    
    // Convert to clip space
    vec2 positionInDevicePixels = centeredPosition * u_devicePixelRatio;
    vec2 clipSpace = ((positionInDevicePixels / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
    
    gl_Position = vec4(clipSpace, 0, 1);
    v_texCoord = a_texCoord;
  }
`;

export const betspotFragmentShaderSource = `
  precision highp float;
  
  uniform vec3 u_glowColor;
  uniform float u_opacity;
  uniform float u_borderRadius;
  uniform vec2 u_size;
  uniform vec2 u_center;
  uniform float u_glowSpread; // How far glow extends beyond object (in pixels)
  
  varying vec2 v_texCoord;
  varying vec2 v_worldCoord;
  
  void main() {
    // Use world coordinates relative to betspot center
    vec2 localCoord = v_worldCoord - u_center;
    float distX = abs(localCoord.x);
    float distY = abs(localCoord.y);
    
    float halfWidth = u_size.x * 0.5;
    float halfHeight = u_size.y * 0.5;
    
    // Calculate distance from betspot edge (simplified)
    // For rectangular area
    float distToEdgeX = halfWidth - distX;
    float distToEdgeY = halfHeight - distY;
    float distFromEdge = min(distToEdgeX, distToEdgeY);
    
    // Handle rounded corners - if in corner region, use corner distance
    if (distX > halfWidth - u_borderRadius && distY > halfHeight - u_borderRadius) {
      vec2 cornerOffset = vec2(
        distX - (halfWidth - u_borderRadius),
        distY - (halfHeight - u_borderRadius)
      );
      float cornerDist = length(cornerOffset);
      
      if (cornerDist <= u_borderRadius) {
        // Inside rounded corner
        distFromEdge = u_borderRadius - cornerDist;
      } else {
        // Outside rounded corner
        distFromEdge = -(cornerDist - u_borderRadius);
      }
    }
    
    // Calculate alpha - inside betspot is full opacity, outside fades in glow area
    float alpha = 1.0;
    
    if (distFromEdge < 0.0) {
      // Outside betspot - fade in glow area
      float glowDist = -distFromEdge;
      if (glowDist > u_glowSpread) {
        discard;
      }
      alpha = 1.0 - smoothstep(0.0, u_glowSpread, glowDist);
    }
    
    gl_FragColor = vec4(u_glowColor, u_opacity * alpha);
  }
`;
