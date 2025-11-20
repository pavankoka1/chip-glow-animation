export const VERTEX_SHADER = `
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

// Fragment shader supporting: start/end via local theta sweep with rotation,
// lineLength segment, center/end radius taper, glow radius with opacity falloff,
// camera tilt and depth amplitude/phase control.
export const FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform mediump float u_time;              // current time in seconds
uniform mediump float u_delay;             // path delay in seconds
uniform mediump float u_animationTime;     // total animation time in seconds
uniform mediump float u_headRadius;        // px (radius at head)
uniform mediump float u_tailRadius;        // px (radius at tail)
uniform mediump float u_glowRadius;        // px (halo size outside)
uniform mediump float u_cameraDistance;
uniform mediump float u_lineLength;        // px
uniform mediump float u_totalArcPx;       // precomputed total arc length in pixels
uniform mediump float u_a;                 // ellipse a (px)
uniform mediump float u_b;                 // ellipse b (px)
uniform mediump float u_rotAngle;          // base rotation of ellipse (radians)
uniform mediump float u_thetaStart;        // local start angle (radians)
uniform mediump float u_thetaEnd;          // local end angle (radians)
uniform mediump float u_dir;               // direction (+1 or -1)
// extra controls
uniform mediump float u_rotExtra;          // extra ellipse rotation (radians)
uniform mediump float u_tiltX;             // camera tilt around X (radians)
uniform mediump float u_tiltY;             // camera tilt around Y (radians)
uniform mediump float u_depthAmp;          // depth amplitude (px)
uniform mediump float u_depthPhase;        // depth phase (radians)
uniform mediump float u_overshoot;         // extra phase beyond 1.0 (phase units)
uniform mediump float u_fadeWindow;        // fade window in phase after tail end
uniform mediump float u_easedNormalizedTime; // eased normalized time (0.0 to 1.0) from JS
uniform mediump float u_ellipseTiltDeg;    // ellipse plane tilt (deg), rotates around major axis
uniform vec3 u_sparkColor;                  // spark color (RGB)
uniform vec3 u_glowColor;                   // glow color (RGB)
varying vec2 v_position;

vec2 project3D(vec3 pos3D) {
  float perspective = 1.0 + (pos3D.z / u_cameraDistance);
  return pos3D.xy / perspective;
}

// Position on rotated ellipse (local theta), centered at u_center, then apply camera tilt
vec3 ellipsePositionLocal(float thetaLocal) {
  float x = u_a * cos(thetaLocal);
  float y = u_b * sin(thetaLocal);
  float baseRot = u_rotAngle + u_rotExtra;
  float c = cos(baseRot);
  float s = sin(baseRot);
  vec2 rotated = vec2(c * x - s * y, s * x + c * y);
  float z = u_depthAmp * sin(thetaLocal + u_depthPhase);
  vec3 p = vec3(rotated, z);
  
  // Apply ellipse plane tilt: rotate around the major axis to tilt the ellipse plane
  // The major axis is (cos(baseRot), sin(baseRot), 0) in XY plane
  // At 0°: minor axis is on z-axis (ellipse plane is vertical, rotate 90° around major axis)
  // At 90°: minor axis is in XY plane (ellipse plane is horizontal, no rotation)
  // So we rotate by (90° - ellipseTiltDeg) around the major axis
  float ellipseTiltDeg = u_ellipseTiltDeg;
  float ellipseTilt = (90.0 - ellipseTiltDeg) * 3.141592653589793 / 180.0; // convert deg to rad
  
  // Major axis direction (in XY plane, this is the rotation axis)
  // Major axis is (cos(baseRot), sin(baseRot), 0)
  vec3 majorAxis = vec3(c, s, 0.0);
  // Normalize (should already be unit, but be safe)
  float axisLen = length(majorAxis);
  if (axisLen > 0.0001) {
    majorAxis = majorAxis / axisLen;
  }
  
  // Rotation around major axis using Rodrigues' rotation formula
  float ct = cos(ellipseTilt);
  float st = sin(ellipseTilt);
  float oneMinusCt = 1.0 - ct;
  
  // Rotation matrix components
  float m00 = ct + majorAxis.x * majorAxis.x * oneMinusCt;
  float m01 = majorAxis.x * majorAxis.y * oneMinusCt - majorAxis.z * st;
  float m02 = majorAxis.x * majorAxis.z * oneMinusCt + majorAxis.y * st;
  float m10 = majorAxis.y * majorAxis.x * oneMinusCt + majorAxis.z * st;
  float m11 = ct + majorAxis.y * majorAxis.y * oneMinusCt;
  float m12 = majorAxis.y * majorAxis.z * oneMinusCt - majorAxis.x * st;
  float m20 = majorAxis.z * majorAxis.x * oneMinusCt - majorAxis.y * st;
  float m21 = majorAxis.z * majorAxis.y * oneMinusCt + majorAxis.x * st;
  float m22 = ct + majorAxis.z * majorAxis.z * oneMinusCt;
  
  // Apply rotation
  p = vec3(
    m00 * p.x + m01 * p.y + m02 * p.z,
    m10 * p.x + m11 * p.y + m12 * p.z,
    m20 * p.x + m21 * p.y + m22 * p.z
  );
  
  // Add perpendicular offset to create visible diversion from diagonal
  // The offset is perpendicular to the major axis in the XY plane
  // Magnitude is based on tilt angle to push ellipse away from diagonal
  // Use the tilt angle directly (0° = no offset, 90° = max offset)
  float tiltOffsetAmount = (ellipseTiltDeg / 90.0) * u_b * 0.3; // Scale with minor axis and tilt
  // Perpendicular to major axis: rotate major axis by 90° in XY plane
  vec2 perpendicularDir = vec2(-majorAxis.y, majorAxis.x); // Perpendicular in XY plane
  p.xy += perpendicularDir * tiltOffsetAmount;
  
  // Apply camera tilt: rotate around X then around Y
  float cx = cos(u_tiltX), sx = sin(u_tiltX);
  float cy = cos(u_tiltY), sy = sin(u_tiltY);
  // rotate X
  vec3 p1 = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  // rotate Y
  vec3 p2 = vec3(cy * p1.x + sy * p1.z, p1.y, -sy * p1.x + cy * p1.z);
  // translate to center
  p2.xy += u_center;
  return p2;
}

// Find closest point along the current visible segment [theta0, theta1] in local theta
// Returns (distancePx, thetaChosenLocal, along01)
// Optimized: reduced samples from 64 to 32 for better performance
vec3 findClosestOnSegment(vec2 pixelPos, float theta0, float theta1) {
  const int SAMPLES_CLOSE = 50;
  float minDist = 1e9;
  float bestT = 0.5;
  for (int i = 0; i < SAMPLES_CLOSE; i++) {
    float tt = float(i) / float(SAMPLES_CLOSE - 1);
    float thetaLocal = mix(theta0, theta1, tt);
    float thetaSample = u_dir * thetaLocal;
    vec3 p3 = ellipsePositionLocal(thetaSample);
    vec2 p2 = project3D(p3);
    float d = distance(pixelPos, p2);
    if (d < minDist) {
      minDist = d;
      bestT = tt;
    }
  }
  float thetaChosen = mix(theta0, theta1, bestT);
  return vec3(minDist, thetaChosen, bestT);
}

void main() {
  vec2 pixelPos = v_position;

  float adjustedTime = u_time - u_delay;
  if (adjustedTime < 0.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  // Local theta range (e.g., 0..|delta|)
  float thetaStart = u_thetaStart;
  float thetaEnd = u_thetaEnd;

  // Use precomputed arc length from JavaScript (much faster than calculating per pixel)
  float totalArcPx = max(u_totalArcPx, 0.0001);
  float segmentParam = clamp(u_lineLength / totalArcPx, 0.0, 1.0);

  // Phase scaling so the full animation (head+tail+overshoot) fits u_animationTime
  // Easing is applied in JavaScript, u_easedNormalizedTime is already eased (0.0 to 1.0)
  float totalSpan = 1.0 + segmentParam + u_overshoot;
  float phase = u_easedNormalizedTime * totalSpan;

  // Allow animation to continue until tail reaches end
  // Use small epsilon to handle floating point precision issues
  float maxPhase = totalSpan;
  float epsilon = 0.0001;
  if (phase >= maxPhase + u_fadeWindow - epsilon) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  // Head can overshoot slightly into the overshoot range
  float segHead = clamp(phase, 0.0, totalSpan);
  float segTail = clamp(phase - segmentParam, 0.0, 1.0);

  // If tail has reached the end (segTail >= 1.0), the segment collapses to a point
  // Start fading out immediately to prevent lingering dot
  if (segTail >= 1.0 - 0.0001) {
    // Calculate how far past the end we are
    float pastEnd = phase - 1.0;
    if (pastEnd >= u_fadeWindow) {
      // Completely fade out after fadeWindow
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }
    // Continue to render but will fade out below
  }

  float thetaTail = mix(thetaStart, thetaEnd, segTail);
  float thetaHead = mix(thetaStart, thetaEnd, min(segHead, 1.0));

  // Closest point on the visible segment
  vec3 closest = findClosestOnSegment(pixelPos, thetaTail, thetaHead);
  float distPx = closest.x;
  float along01 = closest.z; // 0 tail -> 1 head

  // Radius taper: head (along01=1.0) has headRadius, tail (along01=0.0) has tailRadius
  // Gradually decrease from head to tail
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
  // Also fade out when tail reaches end (prevents lingering dot)
  if (phase > maxPhase) {
    float fadeMul = 1.0 - smoothstep(maxPhase, maxPhase + max(u_fadeWindow, 0.0001), phase);
    totalAlpha *= fadeMul;
  } else if (segTail >= 1.0 - 0.0001) {
    // Fade out when tail reaches end (prevents lingering dot at endpoint)
    // This happens when phase >= 1.0 and tail is clamped to 1.0
    float pastEnd = max(0.0, phase - 1.0);
    float fadeOutPhase = clamp(pastEnd / max(u_fadeWindow, 0.0001), 0.0, 1.0);
    float fadeMul = 1.0 - fadeOutPhase;
    totalAlpha *= fadeMul;
  }
  
  gl_FragColor = vec4(finalColor, totalAlpha);
}
`;
