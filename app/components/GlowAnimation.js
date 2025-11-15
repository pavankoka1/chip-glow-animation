"use client";

import { useEffect, useRef } from "react";

const VERTEX_SHADER = `
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

// Fragment shader with path type support
const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec2 u_resolution;
  uniform vec2 u_center;
  uniform mediump float u_time;
  uniform mediump float u_speed;
  uniform mediump float u_delay;
  uniform mediump float u_glow;
  uniform mediump float u_centerRadius;
  uniform mediump float u_cameraDistance;
  uniform mediump float u_pathType;
  uniform mediump float u_lineLength;
  varying vec2 v_position;

  // Project 3D point to 2D screen space with perspective
  vec2 project3D(vec3 pos3D) {
    float perspective = 1.0 + (pos3D.z / u_cameraDistance);
    return pos3D.xy / perspective;
  }

  // Calculate position on path based on type
  // t: parameter from 0 to 1
  // pathType: 0=diagonal-tl-br, 1=diagonal-tr-bl, 2=horizontal, 3=vertical
  vec3 getPathPosition(float t, float pathType) {
    // Clamp t to [0, 1] - no looping, single pass
    t = clamp(t, 0.0, 1.0);
    // Fixed path size (betspot size)
    float betspotSize = 200.0;
    float halfSize = betspotSize * 0.5;
    float pathOffset = 5.0; // 5px away from betspot edge
    float depth = 100.0;
    
    vec3 pos;
    
    if (pathType < 0.5) {
      // Diagonal: Top Left to Bottom Right
      float diagonalDist = halfSize * 1.414213562;
      float semiMajor = diagonalDist + pathOffset;
      float semiMinor = 5.0;
      float ellipseParam = t * 3.14159265;
      float localX = cos(ellipseParam) * semiMajor;
      float localY = sin(ellipseParam) * semiMinor;
      float angle = -0.785398163; // -45°
      float cosAngle = cos(angle);
      float sinAngle = sin(angle);
      float worldX = localX * cosAngle - localY * sinAngle;
      float worldY = localX * sinAngle + localY * cosAngle;
      pos = vec3(u_center.x + worldX, u_center.y + worldY, sin(ellipseParam) * depth);
    } else if (pathType < 1.5) {
      // Diagonal: Top Right to Bottom Left
      float diagonalDist = halfSize * 1.414213562;
      float semiMajor = diagonalDist + pathOffset;
      float semiMinor = 5.0;
      float ellipseParam = t * 3.14159265;
      float localX = cos(ellipseParam) * semiMajor;
      float localY = sin(ellipseParam) * semiMinor;
      float angle = 0.785398163; // 45°
      float cosAngle = cos(angle);
      float sinAngle = sin(angle);
      float worldX = localX * cosAngle - localY * sinAngle;
      float worldY = localX * sinAngle + localY * cosAngle;
      pos = vec3(u_center.x + worldX, u_center.y + worldY, sin(ellipseParam) * depth);
    } else if (pathType < 2.5) {
      // Horizontal
      float ellipseParam = t * 3.14159265 * 2.0; // Full ellipse
      float x = u_center.x + cos(ellipseParam) * (halfSize + pathOffset);
      float y = u_center.y;
      float z = sin(ellipseParam) * depth;
      pos = vec3(x, y, z);
    } else {
      // Vertical
      float ellipseParam = t * 3.14159265 * 2.0; // Full ellipse
      float x = u_center.x;
      float y = u_center.y + cos(ellipseParam) * (halfSize + pathOffset);
      float z = sin(ellipseParam) * depth;
      pos = vec3(x, y, z);
    }
    
    return pos;
  }

  // Calculate approximate path length for a given path type
  // This is used to convert pixel length to parameter length
  float getPathLength(float pathType) {
    // Fixed path size (betspot size)
    float betspotSize = 200.0;
    float halfSize = betspotSize * 0.5;
    float pathOffset = 5.0;
    
    if (pathType < 1.5) {
      // Diagonal paths (0 and 1) - approximate ellipse perimeter
      float diagonalDist = halfSize * 1.414213562;
      float semiMajor = diagonalDist + pathOffset;
      float semiMinor = 5.0;
      // Approximate ellipse perimeter: π * sqrt(2 * (a² + b²))
      return 3.14159265 * sqrt(2.0 * (semiMajor * semiMajor + semiMinor * semiMinor));
    } else if (pathType < 2.5) {
      // Horizontal - full circle circumference
      return 2.0 * 3.14159265 * (halfSize + pathOffset);
    } else {
      // Vertical - full circle circumference
      return 2.0 * 3.14159265 * (halfSize + pathOffset);
    }
  }

  // Find closest point on path segment and return distance and position along segment
  // Returns: vec3(distance, t, alongLine) where alongLine is 0-1 position along the segment
  vec3 findClosestPointOnPath(vec2 pixelPos, float phase, float segmentLength, float pathType) {
    // Calculate path length to convert pixel length to parameter length
    float pathLength = getPathLength(pathType);
    float segmentParamLength = segmentLength / pathLength;
    
    // For ellipse paths, we want the head (front) to start at the major axis vertex
    // So we offset backwards: head at phase, tail at phase - segmentParamLength
    // For other paths, keep the original behavior (tail at phase, head at phase + segmentParamLength)
    float originalStartPhase;
    float originalEndPhase;
    float segmentStartPhase;
    float segmentEndPhase;
    
    if (pathType < 1.5) {
      // Ellipse paths: head starts at phase, tail is behind
      originalEndPhase = phase;  // Head position
      originalStartPhase = phase - segmentParamLength;  // Tail position (behind head)
      
      // For ellipse paths, when phase > 1.0, keep head at end (t=1.0) and move tail forward
      if (phase > 1.0) {
        segmentEndPhase = 1.0;  // Head stays at end of path
        segmentStartPhase = phase - segmentParamLength;  // Tail continues forward
      } else {
        segmentEndPhase = phase;
        segmentStartPhase = phase - segmentParamLength;
      }
    } else {
      // Horizontal and vertical paths: tail at phase, head ahead
      originalStartPhase = phase;
      originalEndPhase = phase + segmentParamLength;
      segmentStartPhase = phase;
      segmentEndPhase = phase + segmentParamLength;
    }
    
    // Clamp to [0, 1] - no wrapping, just a segment that travels
    segmentStartPhase = clamp(segmentStartPhase, 0.0, 1.0);
    segmentEndPhase = clamp(segmentEndPhase, 0.0, 1.0);
    
    float closestT = 0.5;
    float minDist = 10000.0;
    int samples = 300; // Samples for finding closest point
    
    for (int i = 0; i < 300; i++) {
      float t = mix(segmentStartPhase, segmentEndPhase, float(i) / float(samples - 1));
      t = clamp(t, 0.0, 1.0);
      
      vec3 pathPos3D = getPathPosition(t, pathType);
      vec2 pathPos2D = project3D(pathPos3D);
      float dist = distance(pixelPos, pathPos2D);
      if (dist < minDist) {
        minDist = dist;
        closestT = t;
      }
    }
    
    // Calculate position along the segment (0 = tail, 1 = head)
    // Use the actual visible segment range for alongLine calculation
    float visibleRange = segmentEndPhase - segmentStartPhase;
    float alongLine = 0.5;
    if (abs(visibleRange) > 0.001) {
      alongLine = (closestT - segmentStartPhase) / visibleRange;
    }
    // Clamp alongLine to [0, 1]
    alongLine = clamp(alongLine, 0.0, 1.0);
    
    return vec3(minDist, closestT, alongLine);
  }

  void main() {
    vec2 pixelPos = v_position;
    
    // Apply delay to time
    float adjustedTime = u_time - u_delay;
    if (adjustedTime < 0.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }
    
    // Calculate raw phase (can go beyond 1.0 for ellipse paths)
    float rawPhase = adjustedTime * u_speed;
    
    // Calculate path length and segment parameter length for completion check
    float lineLength = u_lineLength;
    float pathLength = getPathLength(u_pathType);
    float segmentParamLength = lineLength / pathLength;
    
    // For ellipse paths, animation completes when tail reaches the end
    // Tail is at (phase - segmentParamLength), so it completes when: phase - segmentParamLength >= 1.0
    // Which means: phase >= 1.0 + segmentParamLength
    // For other paths, animation completes when head reaches the end: phase >= 1.0
    float maxPhase;
    if (u_pathType < 1.5) {
      // Ellipse paths: continue until tail completes (phase can go beyond 1.0)
      maxPhase = 1.0 + segmentParamLength;
    } else {
      // Horizontal and vertical paths: complete when head reaches end
      maxPhase = 1.0;
    }
    
    // Clamp phase to valid range [0, maxPhase]
    float phase = clamp(rawPhase, 0.0, maxPhase);
    
    // If animation is complete, don't render
    if (rawPhase >= maxPhase) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }
    
    // Find closest point on path segment
    vec3 closestInfo = findClosestPointOnPath(pixelPos, phase, lineLength, u_pathType);
    float distToPath = closestInfo.x;
    float alongLine = closestInfo.z;
    
    // Calculate circle radius based on position along line
    // Center (alongLine = 0.5): u_centerRadius
    // Ends (alongLine = 0.0 or 1.0): 0px radius
    // Gradual decrease using smooth curve
    float centerRadius = u_centerRadius;
    
    // Use smooth curve for gradual radius decrease
    // Distance from center: 0 at center, 1 at ends
    float distFromCenter = abs(alongLine - 0.5) * 2.0; // 0 to 1
    // Use smoothstep for smoother taper
    float smoothDist = smoothstep(0.0, 1.0, distFromCenter);
    float radius = centerRadius * (1.0 - smoothDist);
    
    // Draw circle at closest point
    // Core circle (solid)
    float circleAlpha = 1.0 - smoothstep(0.0, radius, distToPath);
    
    // Glow effect - same gold color with reduced opacity, spread out
    float glowSize = radius + u_glow * 2.0; // Spread the glow
    float glowAlpha = 1.0 - smoothstep(radius, glowSize, distToPath);
    glowAlpha *= 0.3; // Reduced opacity for glow
    
    // Combine core and glow
    float totalAlpha = max(circleAlpha, glowAlpha);
    totalAlpha = clamp(totalAlpha, 0.0, 1.0);
    
    // Single gold color (no sparkle, consistent)
    // Gold color: RGB(255, 215, 0) normalized
    vec3 goldColor = vec3(1.0, 0.843, 0.0);
    
    gl_FragColor = vec4(goldColor, totalAlpha);
  }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation error: ${info}`);
  }
  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program linking error: ${info}`);
  }
  return program;
}

// Map path type string to number
const PATH_TYPE_MAP = {
  "diagonal-tl-br": 0,
  "diagonal-tr-bl": 1,
  horizontal: 2,
  vertical: 3,
};

export default function GlowAnimation({
  anchorEl,
  config = {},
  isPlaying = false,
  onAnimationComplete,
}) {
  const canvasRef = useRef(null);
  const startTimeRef = useRef(null);
  const programsRef = useRef([]);
  const animationIdRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Get enabled paths or default
    const paths = (config.paths || []).filter((p) => p.enabled !== false);
    const defaultPath = {
      type: "diagonal-tl-br",
      speed: config.speed || 2.0,
      delay: 0,
      glow: config.glow || 3.0,
      centerRadius: config.centerRadius || 2.0,
    };

    const activePaths = paths.length > 0 ? paths : [defaultPath];

    // Clean up old programs
    programsRef.current.forEach((prog) => {
      if (prog.program) {
        gl.deleteProgram(prog.program);
      }
    });

    // Create shaders and programs for each path
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);

    // Create programs for each path
    programsRef.current = activePaths.map((path) => {
      const fragmentShader = createShader(
        gl,
        gl.FRAGMENT_SHADER,
        FRAGMENT_SHADER
      );
      const program = createProgram(gl, vertexShader, fragmentShader);

      return {
        program,
        path,
        positionLocation: gl.getAttribLocation(program, "a_position"),
        resolutionLocation: gl.getUniformLocation(program, "u_resolution"),
        centerLocation: gl.getUniformLocation(program, "u_center"),
        timeLocation: gl.getUniformLocation(program, "u_time"),
        speedLocation: gl.getUniformLocation(program, "u_speed"),
        delayLocation: gl.getUniformLocation(program, "u_delay"),
        glowLocation: gl.getUniformLocation(program, "u_glow"),
        centerRadiusLocation: gl.getUniformLocation(program, "u_centerRadius"),
        cameraDistanceLocation: gl.getUniformLocation(
          program,
          "u_cameraDistance"
        ),
        pathTypeLocation: gl.getUniformLocation(program, "u_pathType"),
        lineLengthLocation: gl.getUniformLocation(program, "u_lineLength"),
      };
    });

    // Create position buffer (full screen quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0,
        0,
        canvas.width,
        0,
        0,
        canvas.height,
        0,
        canvas.height,
        canvas.width,
        0,
        canvas.width,
        canvas.height,
      ]),
      gl.STATIC_DRAW
    );

    // Enable blending with additive for multiple paths
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const animate = () => {
      // Only animate when isPlaying is true
      if (!isPlaying) {
        animationIdRef.current = null;
        // Clear canvas when not playing
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }

      // Use performance.now() for smoother, more accurate timing
      const currentTime = (performance.now() - startTimeRef.current) / 1000.0;

      // Get anchor center (only calculate once per frame)
      let centerX = canvas.width / 2;
      let centerY = canvas.height / 2;
      if (anchorEl?.getBoundingClientRect) {
        const rect = anchorEl.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
      }

      // Check if all animations are complete
      let allComplete = true;
      const length = config.length || 200.0;

      programsRef.current.forEach((prog) => {
        const pathSpeed = prog.path.speed || config.speed || 2.0;
        const pathDelay = prog.path.delay || 0;
        const adjustedTime = currentTime - pathDelay;
        if (adjustedTime >= 0) {
          const rawPhase = adjustedTime * pathSpeed;
          const pathType = PATH_TYPE_MAP[prog.path.type] || 0;

          // Calculate path length for this path type
          const betspotSize = 200.0;
          const halfSize = betspotSize * 0.5;
          const pathOffset = 5.0;
          let pathLength;

          if (pathType < 1.5) {
            // Diagonal paths (ellipse) - approximate ellipse perimeter
            const diagonalDist = halfSize * 1.414213562;
            const semiMajor = diagonalDist + pathOffset;
            const semiMinor = 5.0;
            pathLength =
              Math.PI *
              Math.sqrt(2.0 * (semiMajor * semiMajor + semiMinor * semiMinor));
          } else if (pathType < 2.5) {
            // Horizontal - full circle circumference
            pathLength = 2.0 * Math.PI * (halfSize + pathOffset);
          } else {
            // Vertical - full circle circumference
            pathLength = 2.0 * Math.PI * (halfSize + pathOffset);
          }

          const segmentParamLength = length / pathLength;

          // For ellipse paths, complete when tail reaches end: rawPhase >= 1.0 + segmentParamLength
          // For other paths, complete when head reaches end: rawPhase >= 1.0
          const maxPhase = pathType < 1.5 ? 1.0 + segmentParamLength : 1.0;

          if (rawPhase < maxPhase) {
            allComplete = false;
          }
        } else {
          allComplete = false;
        }
      });

      // Stop animation if all paths are complete
      if (allComplete && programsRef.current.length > 0) {
        animationIdRef.current = null;
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
        return;
      }

      gl.clear(gl.COLOR_BUFFER_BIT);

      const cameraDistance = 4000.0;
      const lineLength = config.length || 200.0;

      // Draw each path
      programsRef.current.forEach((prog) => {
        gl.useProgram(prog.program);

        // Set uniforms
        gl.uniform2f(prog.resolutionLocation, canvas.width, canvas.height);
        gl.uniform2f(prog.centerLocation, centerX, centerY);
        gl.uniform1f(prog.timeLocation, currentTime);
        gl.uniform1f(
          prog.speedLocation,
          prog.path.speed || config.speed || 2.0
        );
        gl.uniform1f(prog.delayLocation, prog.path.delay || 0);
        gl.uniform1f(prog.glowLocation, prog.path.glow || config.glow || 3.0);
        gl.uniform1f(
          prog.centerRadiusLocation,
          prog.path.centerRadius || config.centerRadius || 2.0
        );
        gl.uniform1f(prog.cameraDistanceLocation, cameraDistance);
        gl.uniform1f(prog.pathTypeLocation, PATH_TYPE_MAP[prog.path.type] || 0);
        gl.uniform1f(prog.lineLengthLocation, lineLength);

        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(prog.positionLocation);
        gl.vertexAttribPointer(prog.positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });

      animationIdRef.current = requestAnimationFrame(animate);
    };

    // Start animation if isPlaying is true
    if (isPlaying && !animationIdRef.current) {
      startTimeRef.current = performance.now();
      animate();
    } else if (!isPlaying && animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      window.removeEventListener("resize", resizeCanvas);
      // Clean up programs
      programsRef.current.forEach((prog) => {
        if (prog.program) {
          gl.deleteProgram(prog.program);
        }
      });
    };
  }, [anchorEl, config, isPlaying, onAnimationComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
}
