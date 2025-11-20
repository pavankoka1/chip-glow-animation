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




export const FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform mediump float u_time;              
uniform mediump float u_delay;             
uniform mediump float u_animationTime;     
uniform mediump float u_headRadius;        
uniform mediump float u_tailRadius;        
uniform mediump float u_glowRadius;        
uniform mediump float u_cameraDistance;
uniform mediump float u_lineLength;        
uniform mediump float u_totalArcPx;       
uniform mediump float u_a;                 
uniform mediump float u_b;                 
uniform mediump float u_rotAngle;          
uniform mediump float u_thetaStart;        
uniform mediump float u_thetaEnd;          
uniform mediump float u_dir;               

uniform mediump float u_rotExtra;          
uniform mediump float u_tiltX;             
uniform mediump float u_tiltY;             
uniform mediump float u_depthAmp;          
uniform mediump float u_depthPhase;        
uniform mediump float u_overshoot;         
uniform mediump float u_fadeWindow;        
uniform mediump float u_easedNormalizedTime; 
uniform mediump float u_ellipseTiltDeg;    
uniform vec3 u_sparkColor;                  
uniform vec3 u_glowColor;                   
varying vec2 v_position;

vec2 project3D(vec3 pos3D) {
  float perspective = 1.0 + (pos3D.z / u_cameraDistance);
  return pos3D.xy / perspective;
}


vec3 ellipsePositionLocal(float thetaLocal) {
  float x = u_a * cos(thetaLocal);
  float y = u_b * sin(thetaLocal);
  float baseRot = u_rotAngle + u_rotExtra;
  float c = cos(baseRot);
  float s = sin(baseRot);
  vec2 rotated = vec2(c * x - s * y, s * x + c * y);
  float z = u_depthAmp * sin(thetaLocal + u_depthPhase);
  vec3 p = vec3(rotated, z);
  
  
  
  
  
  
  float ellipseTiltDeg = u_ellipseTiltDeg;
  float ellipseTilt = (90.0 - ellipseTiltDeg) * 3.141592653589793 / 180.0; 
  
  
  
  vec3 majorAxis = vec3(c, s, 0.0);
  
  float axisLen = length(majorAxis);
  if (axisLen > 0.0001) {
    majorAxis = majorAxis / axisLen;
  }
  
  
  float ct = cos(ellipseTilt);
  float st = sin(ellipseTilt);
  float oneMinusCt = 1.0 - ct;
  
  
  float m00 = ct + majorAxis.x * majorAxis.x * oneMinusCt;
  float m01 = majorAxis.x * majorAxis.y * oneMinusCt - majorAxis.z * st;
  float m02 = majorAxis.x * majorAxis.z * oneMinusCt + majorAxis.y * st;
  float m10 = majorAxis.y * majorAxis.x * oneMinusCt + majorAxis.z * st;
  float m11 = ct + majorAxis.y * majorAxis.y * oneMinusCt;
  float m12 = majorAxis.y * majorAxis.z * oneMinusCt - majorAxis.x * st;
  float m20 = majorAxis.z * majorAxis.x * oneMinusCt - majorAxis.y * st;
  float m21 = majorAxis.z * majorAxis.y * oneMinusCt + majorAxis.x * st;
  float m22 = ct + majorAxis.z * majorAxis.z * oneMinusCt;
  
  
  p = vec3(
    m00 * p.x + m01 * p.y + m02 * p.z,
    m10 * p.x + m11 * p.y + m12 * p.z,
    m20 * p.x + m21 * p.y + m22 * p.z
  );
  
  
  
  
  
  float tiltOffsetAmount = (ellipseTiltDeg / 90.0) * u_b * 0.3; 
  
  vec2 perpendicularDir = vec2(-majorAxis.y, majorAxis.x); 
  p.xy += perpendicularDir * tiltOffsetAmount;
  
  
  float cx = cos(u_tiltX), sx = sin(u_tiltX);
  float cy = cos(u_tiltY), sy = sin(u_tiltY);
  
  vec3 p1 = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  
  vec3 p2 = vec3(cy * p1.x + sy * p1.z, p1.y, -sy * p1.x + cy * p1.z);
  
  p2.xy += u_center;
  return p2;
}




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

  
  float thetaStart = u_thetaStart;
  float thetaEnd = u_thetaEnd;

  
  float totalArcPx = max(u_totalArcPx, 0.0001);
  float segmentParam = clamp(u_lineLength / totalArcPx, 0.0, 1.0);

  
  
  float totalSpan = 1.0 + segmentParam + u_overshoot;
  float phase = u_easedNormalizedTime * totalSpan;

  
  
  float maxPhase = totalSpan;
  float epsilon = 0.0001;
  if (phase >= maxPhase + u_fadeWindow - epsilon) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  
  float segHead = clamp(phase, 0.0, totalSpan);
  float segTail = clamp(phase - segmentParam, 0.0, 1.0);

  
  
  if (segTail >= 1.0 - 0.0001) {
    
    float pastEnd = phase - 1.0;
    if (pastEnd >= u_fadeWindow) {
      
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }
    
  }

  float thetaTail = mix(thetaStart, thetaEnd, segTail);
  float thetaHead = mix(thetaStart, thetaEnd, min(segHead, 1.0));

  
  vec3 closest = findClosestOnSegment(pixelPos, thetaTail, thetaHead);
  float distPx = closest.x;
  float along01 = closest.z; 

  
  
  float radius = mix(u_tailRadius, u_headRadius, along01);

  
  float coreAlpha = 1.0 - smoothstep(0.0, radius, distPx);

  
  float glowAlpha = (1.0 - smoothstep(radius, radius + u_glowRadius, distPx)) * 0.9;

  
  vec3 sparkColor = u_sparkColor;
  vec3 glowColor = u_glowColor;
  
  
  vec3 finalColor;
  if (distPx <= radius) {
    
    finalColor = sparkColor;
  } else {
    
    finalColor = glowColor;
  }
  
  float totalAlpha = max(coreAlpha, glowAlpha);
  totalAlpha = clamp(totalAlpha, 0.0, 1.0);

  
  
  if (phase > maxPhase) {
    float fadeMul = 1.0 - smoothstep(maxPhase, maxPhase + max(u_fadeWindow, 0.0001), phase);
    totalAlpha *= fadeMul;
  } else if (segTail >= 1.0 - 0.0001) {
    
    
    float pastEnd = max(0.0, phase - 1.0);
    float fadeOutPhase = clamp(pastEnd / max(u_fadeWindow, 0.0001), 0.0, 1.0);
    float fadeMul = 1.0 - fadeOutPhase;
    totalAlpha *= fadeMul;
  }
  
  gl_FragColor = vec4(finalColor, totalAlpha);
}
`;
