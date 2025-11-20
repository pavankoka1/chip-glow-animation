export const VERTEX_SHADER_CIRCLE = `
precision mediump float;
attribute vec2 a_position;
uniform vec2 u_resolution;
varying vec2 v_position;

void main() {
  v_position = a_position;
  vec2 zeroToOne = a_position / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = vec2(zeroToTwo.x - 1.0, 1.0 - zeroToTwo.y);
  gl_Position = vec4(clipSpace, 0, 1);
}
`;

// Fragment shader for SparkCircle: ellipse path (first 1/4) transitioning to circle path (remaining 3/4)
// The circle is in XY plane (no Z-axis)
export const FRAGMENT_SHADER_CIRCLE = `
precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform mediump float u_time;              // current time in seconds
uniform mediump float u_delay;             // path delay in seconds
uniform mediump float u_animationTime;     // total animation time in seconds
uniform mediump float u_headRadius;        // px (radius at head)
uniform mediump float u_tailRadius;        // px (radius at tail)
uniform mediump float u_glowRadius;        // px (halo size outside)
uniform mediump float u_lineLength;        // px
uniform mediump float u_totalArcPx;       // precomputed total arc length in pixels
uniform mediump float u_a;                 // ellipse a (px)
uniform mediump float u_b;                 // ellipse b (px)
uniform mediump float u_rotAngle;          // base rotation of ellipse (radians) - 45° = π/4 (major axis along y = x, from BL to TR)
uniform mediump float u_circleRadius;      // circle radius (px)
uniform mediump float u_startTheta;        // ellipse parameter theta for BR vertex
uniform mediump float u_meetingTheta;      // ellipse parameter theta for meeting point
uniform mediump float u_ellipsePortion;    // precomputed ellipse portion (0.0 to 1.0)
uniform mediump float u_circlePortion;      // precomputed circle portion (0.0 to 1.0)
uniform mediump float u_meetingCircleAngle; // precomputed meeting point angle on circle
uniform mediump float u_overshoot;         // extra phase beyond 1.0 (phase units)
uniform mediump float u_fadeWindow;        // fade window in phase after tail end
uniform mediump float u_easedNormalizedTime; // eased normalized time (0.0 to 1.0) from JS
uniform vec3 u_sparkColor;                  // spark color (RGB)
uniform vec3 u_glowColor;                   // glow color (RGB)
varying vec2 v_position;

// Position on rotated ellipse path
// Coordinate system: X+ = right, Y+ = up (mathematical coordinates)
// Returns position in screen coordinates (Y+ down) for rendering
// theta is the parameter angle (0 to 2π)
vec2 ellipsePosition(float theta) {
  // Ellipse in local coordinates (before rotation)
  float x_local = u_a * cos(theta);
  float y_local = u_b * sin(theta);
  
  // Apply rotation: major axis is at rotAngle (45° = π/4)
  // This rotates the ellipse so the major axis is along y = x (from BL to TR)
  // Result is in mathematical coordinates (Y+ up)
  float c = cos(u_rotAngle);
  float s = sin(u_rotAngle);
  float x_math = c * x_local - s * y_local;
  float y_math = s * x_local + c * y_local;
  
  // Convert to screen coordinates: screen Y = -math Y (flip Y axis)
  // u_center is in screen coordinates
  float x_screen = x_math + u_center.x;
  float y_screen = -y_math + u_center.y; // Flip Y for screen coords
  
  return vec2(x_screen, y_screen);
}

// Position on circle path (centered at u_center)
// Coordinate system: X+ = right, Y+ = up (mathematical coordinates)
// Returns position in screen coordinates (Y+ down) for rendering
vec2 circlePosition(float angle) {
  // Circle in mathematical coordinates (Y+ up)
  float x_math = u_circleRadius * cos(angle);
  float y_math = u_circleRadius * sin(angle);
  
  // Convert to screen coordinates: screen Y = -math Y (flip Y axis)
  // u_center is in screen coordinates
  float x_screen = x_math + u_center.x;
  float y_screen = -y_math + u_center.y; // Flip Y for screen coords
  
  return vec2(x_screen, y_screen);
}

// Get position along the combined path
// t is normalized path parameter (0.0 to 1.0)
// Returns 2D position in screen space
// OPTIMIZED: Uses precomputed values from JavaScript instead of recalculating
vec2 getPathPosition(float t) {
  const float circleRotations = 2.0; // 2 full rotations
  const float totalRotation = circleRotations * 2.0 * 3.141592653589793; // 4π
  
  // Use precomputed portions from JavaScript (much faster!)
  float ellipsePortion = u_ellipsePortion;
  float circlePortion = u_circlePortion;
  
  if (t <= ellipsePortion) {
    // Ellipse portion: from start vertex to meeting point
    float ellipseT = t / ellipsePortion;
    float theta = mix(u_startTheta, u_meetingTheta, ellipseT);
    return ellipsePosition(theta);
  } else {
    // Circle portion: from meeting point, rotate 2 times clockwise
    float circleT = (t - ellipsePortion) / circlePortion;
    
    // Use precomputed meeting circle angle (much faster!)
    float meetingCircleAngle = u_meetingCircleAngle;
    
    // Rotate 2 full times clockwise
    // In math coords (Y+ up), clockwise = decreasing angle (negative direction)
    float angle = meetingCircleAngle - totalRotation * circleT; // Negative for clockwise
    return circlePosition(angle);
  }
}

// Find closest point along the current visible segment [t0, t1]
// Returns (distancePx, tChosen, along01)
vec3 findClosestOnSegment(vec2 pixelPos, float t0, float t1) {
  const int SAMPLES_CLOSE = 32;
  float minDist = 1e9;
  float bestT = 0.5;
  for (int i = 0; i < SAMPLES_CLOSE; i++) {
    float tt = float(i) / float(SAMPLES_CLOSE - 1);
    float tLocal = mix(t0, t1, tt);
    vec2 p2 = getPathPosition(tLocal);
    float d = distance(pixelPos, p2);
    if (d < minDist) {
      minDist = d;
      bestT = tt;
    }
  }
  float tChosen = mix(t0, t1, bestT);
  return vec3(minDist, tChosen, bestT);
}

void main() {
  vec2 pixelPos = v_position;

  float adjustedTime = u_time - u_delay;
  if (adjustedTime < 0.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  // Use precomputed arc length from JavaScript
  float totalArcPx = max(u_totalArcPx, 0.0001);
  float segmentParam = clamp(u_lineLength / totalArcPx, 0.0, 1.0);

  // Phase scaling so the full animation (head+tail+overshoot) fits u_animationTime
  float totalSpan = 1.0 + segmentParam + u_overshoot;
  float phase = u_easedNormalizedTime * totalSpan;

  // Allow animation to continue until tail reaches end
  float maxPhase = totalSpan;
  float epsilon = 0.0001;
  if (phase >= maxPhase + u_fadeWindow - epsilon) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  // Head can overshoot slightly into the overshoot range
  float segHead = clamp(phase, 0.0, totalSpan);
  float segTail = clamp(phase - segmentParam, 0.0, 1.0);

  // If tail has reached the end, start fading out
  if (segTail >= 1.0 - 0.0001) {
    float pastEnd = phase - 1.0;
    if (pastEnd >= u_fadeWindow) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }
  }

  // Map phase to path parameter t (0.0 to 1.0)
  float tTail = mix(0.0, 1.0, segTail);
  float tHead = mix(0.0, 1.0, min(segHead, 1.0));

  // Closest point on the visible segment
  vec3 closest = findClosestOnSegment(pixelPos, tTail, tHead);
  float distPx = closest.x;
  float along01 = closest.z; // 0 tail -> 1 head

  // Radius taper: head (along01=1.0) has headRadius, tail (along01=0.0) has tailRadius
  float radius = mix(u_tailRadius, u_headRadius, along01);

  // Core opacity (solid circle)
  float coreAlpha = 1.0 - smoothstep(0.0, radius, distPx);

  // Glow outside the circle: 0.9 at radius fading to ~0 at radius+glowRadius
  float glowAlpha = (1.0 - smoothstep(radius, radius + u_glowRadius, distPx)) * 0.9;

  // Use spark color for core, glow color for glow
  vec3 sparkColor = u_sparkColor;
  vec3 glowColor = u_glowColor;
  
  // Select color based on distance: core area uses sparkColor, glow area uses glowColor
  vec3 finalColor;
  if (distPx <= radius) {
    // Inside core - use spark color
    finalColor = sparkColor;
  } else {
    // In glow area - use glow color
    finalColor = glowColor;
  }
  
  float totalAlpha = max(coreAlpha, glowAlpha);
  totalAlpha = clamp(totalAlpha, 0.0, 1.0);

  // Fade out gracefully during overshoot window
  if (phase > maxPhase) {
    float fadeMul = 1.0 - smoothstep(maxPhase, maxPhase + max(u_fadeWindow, 0.0001), phase);
    totalAlpha *= fadeMul;
  } else if (segTail >= 1.0 - 0.0001) {
    // Fade out when tail reaches end
    float pastEnd = max(0.0, phase - 1.0);
    float fadeOutPhase = clamp(pastEnd / max(u_fadeWindow, 0.0001), 0.0, 1.0);
    float fadeMul = 1.0 - fadeOutPhase;
    totalAlpha *= fadeMul;
  }
  
  gl_FragColor = vec4(finalColor, totalAlpha);
}
`;

