"use client";

import { useEffect, useRef } from "react";

const VERTEX_SHADER = `
  precision mediump float;
  attribute vec2 a_position;
  uniform vec2 u_resolution;
  uniform mediump float u_cameraDistance;
  varying vec2 v_position;

  void main() {
    v_position = a_position;
    vec2 zeroToOne = a_position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = vec2(zeroToTwo.x - 1.0, 1.0 - zeroToTwo.y);
    gl_Position = vec4(clipSpace, 0, 1);
  }
`;

// Generate fragment shader with path type support
const generateFragmentShader = () => `
  precision mediump float;
  uniform vec2 u_resolution;
  uniform vec2 u_center;
  uniform mediump float u_time;
  uniform mediump float u_speed;
  uniform mediump float u_delay;
  uniform mediump float u_glow;
  uniform mediump float u_centerThickness;
  uniform mediump float u_endThickness;
  uniform mediump float u_cameraDistance;
  uniform mediump float u_pathType;
  varying vec2 v_position;

  // Project 3D point to 2D screen space with perspective
  vec2 project3D(vec3 pos3D) {
    float perspective = 1.0 + (pos3D.z / u_cameraDistance);
    return pos3D.xy / perspective;
  }

  // Calculate position on path based on type
  // t: can be any value (will be wrapped to 0-1 for continuous animation)
  // pathType: 0=diagonal-tl-br, 1=diagonal-tr-bl, 2=horizontal, 3=vertical
  vec3 getPathPosition(float t, float pathType) {
    // Wrap t to [0, 1] for continuous looping
    t = mod(t, 1.0);
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

  // Calculate distance from point to curved line
  float distanceToCurvedLine(vec2 pixelPos, float phase, float lineLength, float pathType) {
    float betspotSize = 200.0;
    float diagonal = betspotSize * 1.414213562;
    float lineParamLength = lineLength / diagonal;
    
    // Line segment spans from phase to phase + lineParamLength
    // The line should be exactly diagonal length, traveling along the path
    float lineStartPhase = phase;
    float lineEndPhase = phase + lineParamLength;
    
    // Clamp to [0, 1] - no wrapping, just a segment that travels
    lineStartPhase = clamp(lineStartPhase, 0.0, 1.0);
    lineEndPhase = clamp(lineEndPhase, 0.0, 1.0);
    
    // Increase samples for better quality, especially for thicker lines
    float minDist = 10000.0;
    int samples = 400; // Increased for better quality
    
    for (int i = 0; i < 400; i++) {
      // Sample along the line segment (no wrapping)
      float t = mix(lineStartPhase, lineEndPhase, float(i) / float(samples - 1));
      t = clamp(t, 0.0, 1.0);
      
      vec3 pathPos3D = getPathPosition(t, pathType);
      vec2 pathPos2D = project3D(pathPos3D);
      float dist = distance(pixelPos, pathPos2D);
      if (dist < minDist) {
        minDist = dist;
      }
    }
    
    return minDist;
  }

  void main() {
    vec2 pixelPos = v_position;
    
    // Apply delay to time
    float adjustedTime = u_time - u_delay;
    if (adjustedTime < 0.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }
    
    // Animation phase (0 to 1, loops infinitely)
    float phase = mod(adjustedTime * u_speed, 1.0);
    
    // Line length - exactly diagonal length
    float betspotSize = 200.0;
    float diagonal = betspotSize * 1.414213562;
    float lineLength = diagonal; // Line segment is exactly diagonal length
    
    // Calculate distance from pixel to the curved line
    float distToLine = distanceToCurvedLine(pixelPos, phase, lineLength, u_pathType);
    
    // Calculate position along the line segment
    float diagonal2 = betspotSize * 1.414213562;
    float lineParamLength = lineLength / diagonal2;
    float lineStartPhase = phase;
    float lineEndPhase = phase + lineParamLength;
    
    // Clamp to [0, 1] - no wrapping
    lineStartPhase = clamp(lineStartPhase, 0.0, 1.0);
    lineEndPhase = clamp(lineEndPhase, 0.0, 1.0);
    
    float closestT = 0.5;
    float minDistForT = 10000.0;
    int samplesForT = 200; // Increased for better quality
    for (int i = 0; i < 200; i++) {
      float t = mix(lineStartPhase, lineEndPhase, float(i) / float(samplesForT - 1));
      t = clamp(t, 0.0, 1.0);
      
      vec3 pathPos3D = getPathPosition(t, u_pathType);
      vec2 pathPos2D = project3D(pathPos3D);
      float dist = distance(pixelPos, pathPos2D);
      if (dist < minDistForT) {
        minDistForT = dist;
        closestT = t;
      }
    }
    
    // Calculate position along the line segment
    float phaseRange = lineEndPhase - lineStartPhase;
    float alongLine = 0.5;
    if (phaseRange > 0.001) {
      alongLine = (closestT - lineStartPhase) / phaseRange;
    }
    alongLine = clamp(alongLine, 0.0, 1.0);
    
    // Tapered thickness with glow - configurable
    float centerThickness = u_centerThickness;
    float endThickness = u_endThickness;
    float thicknessFactor = 1.0 - abs(alongLine - 0.5) * 2.0;
    float thickness = mix(endThickness, centerThickness, thicknessFactor);
    
    // Multi-layer glow for better quality
    // Inner glow (core line)
    float coreGlow = 1.0 - smoothstep(0.0, thickness, distToLine);
    
    // Middle glow layer
    float middleGlowSize = thickness + u_glow * 0.5;
    float middleGlow = 1.0 - smoothstep(thickness, middleGlowSize, distToLine);
    middleGlow *= 0.6; // Slightly less intense
    
    // Outer glow layer (soft halo)
    float outerGlowSize = thickness + u_glow;
    float outerGlow = 1.0 - smoothstep(middleGlowSize, outerGlowSize, distToLine);
    outerGlow *= 0.3; // Soft outer glow
    
    // Combine all glow layers
    float totalGlow = coreGlow + middleGlow + outerGlow;
    totalGlow = clamp(totalGlow, 0.0, 1.0);
    
    // Sparkle effect
    float sparkle = sin(alongLine * 3.14159 * 4.0 + u_time * 10.0) * 0.3 + 0.7;
    
    // Original white/yellow sparkle color
    vec3 color = vec3(1.0, 1.0, 0.9) * (0.8 + sparkle * 0.2);
    
    // Calculate final alpha with enhanced glow
    float alpha = totalGlow * sparkle;
    
    gl_FragColor = vec4(color, alpha);
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

export default function GlowAnimation({ anchorEl, config = {} }) {
  const canvasRef = useRef(null);
  const startTimeRef = useRef(null);
  const programsRef = useRef([]);

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
    };

    const activePaths = paths.length > 0 ? paths : [defaultPath];

    // Create shaders and programs for each path
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShaderSource = generateFragmentShader();

    // Clean up old programs
    programsRef.current.forEach((prog) => {
      if (prog.program) {
        gl.deleteProgram(prog.program);
      }
    });

    // Create programs for each path
    programsRef.current = activePaths.map((path) => {
      const fragmentShader = createShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentShaderSource
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
        centerThicknessLocation: gl.getUniformLocation(
          program,
          "u_centerThickness"
        ),
        endThicknessLocation: gl.getUniformLocation(program, "u_endThickness"),
        cameraDistanceLocation: gl.getUniformLocation(
          program,
          "u_cameraDistance"
        ),
        pathTypeLocation: gl.getUniformLocation(program, "u_pathType"),
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

    let animationId = null;
    startTimeRef.current = Date.now();

    const animate = () => {
      const currentTime = (Date.now() - startTimeRef.current) / 1000;

      // Get anchor center
      let centerX = canvas.width / 2;
      let centerY = canvas.height / 2;
      if (anchorEl?.getBoundingClientRect) {
        const rect = anchorEl.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
      }

      gl.clear(gl.COLOR_BUFFER_BIT);

      const cameraDistance = 1000;

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
          prog.centerThicknessLocation,
          prog.path.centerThickness || config.centerThickness || 4.0
        );
        gl.uniform1f(
          prog.endThicknessLocation,
          prog.path.endThickness || config.endThickness || 1.0
        );
        gl.uniform1f(prog.cameraDistanceLocation, cameraDistance);
        gl.uniform1f(prog.pathTypeLocation, PATH_TYPE_MAP[prog.path.type] || 0);

        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(prog.positionLocation);
        gl.vertexAttribPointer(prog.positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      window.removeEventListener("resize", resizeCanvas);
      // Clean up programs
      programsRef.current.forEach((prog) => {
        if (prog.program) {
          gl.deleteProgram(prog.program);
        }
      });
    };
  }, [anchorEl, config]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
}
