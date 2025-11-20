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



export const FRAGMENT_SHADER_CIRCLE = `
precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform mediump float u_time;              
uniform mediump float u_delay;             
uniform mediump float u_animationTime;     
uniform mediump float u_headRadius;        
uniform mediump float u_tailRadius;        
uniform mediump float u_glowRadius;        
uniform mediump float u_lineLength;        
uniform mediump float u_totalArcPx;       
uniform mediump float u_a;                 
uniform mediump float u_b;                 
uniform mediump float u_rotAngle;          
uniform mediump float u_circleRadius;      
uniform mediump float u_startTheta;        
uniform mediump float u_meetingTheta;      
uniform mediump float u_ellipsePortion;    
uniform mediump float u_circlePortion;      
uniform mediump float u_meetingCircleAngle; 
uniform mediump float u_overshoot;         
uniform mediump float u_fadeWindow;        
uniform mediump float u_easedNormalizedTime; 
uniform vec3 u_sparkColor;                  
uniform vec3 u_glowColor;                   
varying vec2 v_position;





vec2 ellipsePosition(float theta) {
  
  float x_local = u_a * cos(theta);
  float y_local = u_b * sin(theta);
  
  
  
  float c = cos(u_rotAngle);
  float s = sin(u_rotAngle);
  float x_math = c * x_local - s * y_local;
  float y_math = s * x_local + c * y_local;
  
  
  float x_screen = x_math + u_center.x;
  float y_screen = -y_math + u_center.y;
  
  return vec2(x_screen, y_screen);
}




vec2 circlePosition(float angle) {
  
  float x_math = u_circleRadius * cos(angle);
  float y_math = u_circleRadius * sin(angle);
  
  
  
  float x_screen = x_math + u_center.x;
  float y_screen = -y_math + u_center.y; 
  
  return vec2(x_screen, y_screen);
}





vec2 getPathPosition(float t) {
  const float circleRotations = 2.0; 
  const float totalRotation = circleRotations * 2.0 * 3.141592653589793; 
  
  
  float ellipsePortion = u_ellipsePortion;
  float circlePortion = u_circlePortion;
  
  if (t <= ellipsePortion) {
    
    float ellipseT = t / ellipsePortion;
    float theta = mix(u_startTheta, u_meetingTheta, ellipseT);
    return ellipsePosition(theta);
  } else {
    
    float circleT = (t - ellipsePortion) / circlePortion;
    
    
    float meetingCircleAngle = u_meetingCircleAngle;
    
    
    
    float angle = meetingCircleAngle - totalRotation * circleT; 
    return circlePosition(angle);
  }
}



vec3 findClosestOnSegment(vec2 pixelPos, float t0, float t1) {
  const int SAMPLES_CLOSE = 50;
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

  
  float tTail = mix(0.0, 1.0, segTail);
  float tHead = mix(0.0, 1.0, min(segHead, 1.0));

  
  vec3 closest = findClosestOnSegment(pixelPos, tTail, tHead);
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

