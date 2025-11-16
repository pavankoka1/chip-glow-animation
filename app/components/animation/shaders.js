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
uniform mediump float u_centerRadius;      // px
uniform mediump float u_endRadius;         // px
uniform mediump float u_glowRadius;        // px (halo size outside)
uniform mediump float u_cameraDistance;
uniform mediump float u_lineLength;        // px
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
  // Tilt around X then around Y
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

// Approximate arc length over local theta range (match projection & tilt)
float approximateArcLength(float theta0, float theta1) {
  const int SAMPLES_ARC = 64;
  float total = 0.0;
  vec3 prev3 = ellipsePositionLocal(theta0);
  vec2 prev = project3D(prev3);
  for (int i = 1; i <= SAMPLES_ARC; i++) {
    float t = float(i) / float(SAMPLES_ARC);
    float thetaLocal = mix(theta0, theta1, t);
    vec3 p3 = ellipsePositionLocal(thetaLocal);
    vec2 p = project3D(p3);
    total += distance(prev, p);
    prev = p;
  }
  return total;
}

// Find closest point along the current visible segment [theta0, theta1] in local theta
// Returns (distancePx, thetaChosenLocal, along01)
vec3 findClosestOnSegment(vec2 pixelPos, float theta0, float theta1) {
  const int SAMPLES_CLOSE = 64;
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

  // Compute visible segment based on line length in pixels
  float totalArcPx = approximateArcLength(thetaStart, thetaEnd);
  float segmentParam = clamp(u_lineLength / max(totalArcPx, 0.0001), 0.0, 1.0);

  // Phase scaling so the full animation (head+tail+overshoot) fits u_animationTime
  float totalSpan = 1.0 + segmentParam + u_overshoot;
  float phase = (adjustedTime / max(u_animationTime, 0.0001)) * totalSpan;

  // Allow animation to continue until tail reaches end
  float maxPhase = totalSpan;
  if (phase >= maxPhase + u_fadeWindow) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  // Head can overshoot slightly into the overshoot range
  float segHead = clamp(phase, 0.0, totalSpan);
  float segTail = clamp(phase - segmentParam, 0.0, 1.0);

  float thetaTail = mix(thetaStart, thetaEnd, segTail);
  float thetaHead = mix(thetaStart, thetaEnd, min(segHead, 1.0));

  // Closest point on the visible segment
  vec3 closest = findClosestOnSegment(pixelPos, thetaTail, thetaHead);
  float distPx = closest.x;
  float along01 = closest.z; // 0 tail -> 1 head

  // Radius taper: center at along=0.5, ends at along=0 or 1
  float distFromCenter = abs(along01 - 0.5) * 2.0;
  float smoothDist = smoothstep(0.0, 1.0, distFromCenter);
  float radius = mix(u_endRadius, u_centerRadius, 1.0 - smoothDist);

  // Core opacity (solid circle)
  float coreAlpha = 1.0 - smoothstep(0.0, radius, distPx);

  // Glow outside the circle: 0.9 at radius fading to ~0 at radius+glowRadius
  float glowAlpha = (1.0 - smoothstep(radius, radius + u_glowRadius, distPx)) * 0.9;

  float totalAlpha = max(coreAlpha, glowAlpha);
  totalAlpha = clamp(totalAlpha, 0.0, 1.0);

  // Fade out gracefully during overshoot window
  if (phase > maxPhase) {
    float fadeMul = 1.0 - smoothstep(maxPhase, maxPhase + max(u_fadeWindow, 0.0001), phase);
    totalAlpha *= fadeMul;
  }

  vec3 gold = vec3(1.0, 0.843, 0.0);
  gl_FragColor = vec4(gold, totalAlpha);
}
`;
