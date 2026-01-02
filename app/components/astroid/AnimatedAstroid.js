"use client";

import { useEffect, useRef } from "react";
import {
  createProgram,
  createShader,
  getDevicePixelRatio,
} from "../webgl/webgl/webglUtils";
// Fragment shader matching coneShaders but adjusted for new dimensions
const fragmentShaderSource = `
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
    float minPossibleZ = u_height - maxHemisphereRadius - 1.0;
    float maxPossibleZ = u_height + maxHemisphereRadius + 1.0;
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
            float baseZ = u_height; // Hemisphere attached at z=height
            float zRelative = v_position.z - baseZ;
            float cosPhi = -zRelative / whiteHemisphereRadius;
            cosPhi = clamp(cosPhi, 0.0, 1.0);
            float sinPhi = sqrt(1.0 - cosPhi * cosPhi);
            whiteRadius = whiteHemisphereRadius * sinPhi;
            yellowRadius = whiteRadius;
        } else if (v_coneType < 1.5) {
            float whiteHemisphereRadius = u_baseRadius * u_whiteRadiusRatio;
            float yellowHemisphereRadius = u_baseRadius * (u_whiteRadiusRatio + u_yellowRadiusRatio);
            float baseZ = u_height; // Hemisphere attached at z=height
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
import * as sparkAnimation from "../canvas2d/animations/spark";
import { applyEasingSpark } from "../canvas2d/easing";
import { getEllipsePosition2D } from "../canvas2d/geometry";

// Modified vertex shader with position offset support (same as coneShaders but with u_positionOffset)
const vertexShaderSource = `
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
uniform vec2 u_positionOffset;

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
        flippedZ - centerOffsetZ + u_resolution.x * 0.5,
        scaledPosition.y + u_resolution.y * 0.5
    );
    
    // Apply position offset (in device pixels, matching u_resolution)
    screenPos += u_positionOffset;
    
    vec2 positionInDevicePixels = screenPos * u_devicePixelRatio;
    vec2 clipSpace = ((positionInDevicePixels / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
    
    gl_Position = vec4(clipSpace, 0, 1);
    
    v_position = a_position;
    v_coneType = a_coneType;
}`;

// Spark 1 path configuration (BR to TL) - from defaultConfig.js
const SPARK_PATH = {
  id: 1,
  type: "spark",
  startVertex: "BR",
  endVertex: "TL",
  animationTimeMs: 750,
  delay: 0,
  ellipseTiltDeg: -45,
  ellipseRotationDeg: -2,
  sparkColor: "#fefe51",
  headRadius: 2,
  tailRadius: 0.4,
  length: 5.0,
  dotCount: 10,
  enabled: true,
  whiteCenterRatio: 0.5,
  glowRadiusMultiplier: 0.5,
  glowOpacityStart: 1.2,
  glowSideSuppression: 0.75,
  headTaperRatio: 0.08,
  tipRadius: 0.5,
};

// Astroid dimensions from config
const BASE_RADIUS = SPARK_PATH.headRadius; // 2
const HEIGHT = SPARK_PATH.length; // 5.0
const WHITE_RADIUS_RATIO = 0.6;
const YELLOW_RADIUS_RATIO = 0.4;
const SCALE = 20.0; // Scale up to make it visible (same as astroid page)

export default function AnimatedAstroid({ anchorEl, isPlaying = false }) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const buffersRef = useRef({
    position: null,
    coneType: null,
    index: null,
  });
  const animationIdRef = useRef(null);
  const lastTsRef = useRef(null);
  const accumulatedSecRef = useRef(0);
  const anchorRectRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const metricsRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });

    if (!gl) {
      return;
    }

    glRef.current = gl;

    try {
      const vertexShader = createShader(
        gl,
        gl.VERTEX_SHADER,
        vertexShaderSource
      );
      const fragmentShader = createShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentShaderSource
      );
      const program = createProgram(gl, vertexShader, fragmentShader);
      programRef.current = program;

      gl.useProgram(program);

      const positionLocation = gl.getAttribLocation(program, "a_position");
      const coneTypeLocation = gl.getAttribLocation(program, "a_coneType");
      const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
      const devicePixelRatioLocation = gl.getUniformLocation(
        program,
        "u_devicePixelRatio"
      );
      const scaleLocation = gl.getUniformLocation(program, "u_scale");
      const baseRadiusLocation = gl.getUniformLocation(program, "u_baseRadius");
      const heightLocation = gl.getUniformLocation(program, "u_height");
      const whiteRadiusRatioLocation = gl.getUniformLocation(
        program,
        "u_whiteRadiusRatio"
      );
      const yellowRadiusRatioLocation = gl.getUniformLocation(
        program,
        "u_yellowRadiusRatio"
      );
      const rotateXLocation = gl.getUniformLocation(program, "u_rotateX");
      const rotateYLocation = gl.getUniformLocation(program, "u_rotateY");
      const rotateZLocation = gl.getUniformLocation(program, "u_rotateZ");
      const bendAngleLocation = gl.getUniformLocation(program, "u_bendAngle");
      const positionOffsetLocation = gl.getUniformLocation(
        program,
        "u_positionOffset"
      );
      const glowRadiusLocation = gl.getUniformLocation(program, "u_glowRadius");
      const glowSpreadLocation = gl.getUniformLocation(program, "u_glowSpread");
      const glowColorLocation = gl.getUniformLocation(program, "u_glowColor");

      const positionBuffer = gl.createBuffer();
      const coneTypeBuffer = gl.createBuffer();
      const indexBuffer = gl.createBuffer();

      buffersRef.current = {
        position: positionBuffer,
        coneType: coneTypeBuffer,
        index: indexBuffer,
      };

      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);

      const resizeCanvas = () => {
        const dpr = getDevicePixelRatio();
        const width = window.innerWidth;
        const height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        gl.viewport(0, 0, canvas.width, canvas.height);
        if (program) {
          gl.useProgram(program);
          if (resolutionLocation) {
            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
          }
          if (devicePixelRatioLocation) {
            gl.uniform1f(devicePixelRatioLocation, dpr);
          }
        }
      };

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      // Generate geometry exactly like ConeViewer (same structure)
      const generateGeometry = () => {
        const sectors = 36;
        const stacks = 30;
        const vertices = [];
        const coneTypes = [];
        const indices = [];
        let vertexIndex = 0;

        for (let coneType = 0; coneType < 2; coneType++) {
          const coneStartIndex = vertexIndex;

          for (let i = 0; i <= stacks; i++) {
            const u = i / stacks;
            const currentRadius = BASE_RADIUS * (1 - u);

            for (let j = 0; j <= sectors; j++) {
              const theta = (j / sectors) * 2 * Math.PI;
              const x = currentRadius * Math.cos(theta);
              const y = currentRadius * Math.sin(theta);
              const z = HEIGHT * u;

              vertices.push(x, y, z);
              coneTypes.push(coneType);

              if (i < stacks && j < sectors) {
                const current = coneStartIndex + i * (sectors + 1) + j;
                const next = coneStartIndex + (i + 1) * (sectors + 1) + j;
                const currentNext =
                  coneStartIndex + i * (sectors + 1) + (j + 1);
                const nextNext =
                  coneStartIndex + (i + 1) * (sectors + 1) + (j + 1);

                indices.push(current, next, currentNext);
                indices.push(currentNext, next, nextNext);
              }
            }
          }

          const baseCenterIndex = vertexIndex;
          vertices.push(0, 0, HEIGHT);
          coneTypes.push(coneType);
          vertexIndex++;

          const baseStartIndex = vertexIndex;
          for (let j = 0; j <= sectors; j++) {
            const theta = (j / sectors) * 2 * Math.PI;
            const x = BASE_RADIUS * Math.cos(theta);
            const y = BASE_RADIUS * Math.sin(theta);
            const z = HEIGHT;
            vertices.push(x, y, z);
            coneTypes.push(coneType);
            vertexIndex++;
          }

          for (let j = 0; j < sectors; j++) {
            const v1 = baseStartIndex + j;
            const v2 = baseStartIndex + (j + 1);
            indices.push(baseCenterIndex, v1, v2);
          }

          vertexIndex = vertices.length / 3;
        }

        const hemisphereSectors = 36;
        const hemisphereStacks = 18;
        const whiteHemisphereRadius = BASE_RADIUS * WHITE_RADIUS_RATIO;
        const whiteHemisphereStartIndex = vertexIndex;

        for (let i = 0; i <= hemisphereStacks; i++) {
          const phi = Math.PI / 2 - (i / hemisphereStacks) * (Math.PI / 2);
          const currentRadius = whiteHemisphereRadius * Math.sin(phi);

          for (let j = 0; j <= hemisphereSectors; j++) {
            const theta = (j / hemisphereSectors) * 2 * Math.PI;
            const x = currentRadius * Math.cos(theta);
            const y = currentRadius * Math.sin(theta);
            // Hemisphere attached at z=HEIGHT, extending upward
            const z = HEIGHT - whiteHemisphereRadius * Math.cos(phi);

            vertices.push(x, y, z);
            coneTypes.push(0);

            if (i < hemisphereStacks && j < hemisphereSectors) {
              const current =
                whiteHemisphereStartIndex + i * (hemisphereSectors + 1) + j;
              const next =
                whiteHemisphereStartIndex +
                (i + 1) * (hemisphereSectors + 1) +
                j;
              const currentNext =
                whiteHemisphereStartIndex +
                i * (hemisphereSectors + 1) +
                (j + 1);
              const nextNext =
                whiteHemisphereStartIndex +
                (i + 1) * (hemisphereSectors + 1) +
                (j + 1);

              indices.push(current, currentNext, next);
              indices.push(currentNext, nextNext, next);
            }
          }
        }

        vertexIndex = vertices.length / 3;

        const yellowHemisphereRadius =
          BASE_RADIUS * (WHITE_RADIUS_RATIO + YELLOW_RADIUS_RATIO);
        const yellowHemisphereStartIndex = vertexIndex;

        for (let i = 0; i <= hemisphereStacks; i++) {
          const phi = Math.PI / 2 - (i / hemisphereStacks) * (Math.PI / 2);
          const currentRadius = yellowHemisphereRadius * Math.sin(phi);

          for (let j = 0; j <= hemisphereSectors; j++) {
            const theta = (j / hemisphereSectors) * 2 * Math.PI;
            const x = currentRadius * Math.cos(theta);
            const y = currentRadius * Math.sin(theta);
            // Hemisphere attached at z=HEIGHT, extending upward
            const z = HEIGHT - yellowHemisphereRadius * Math.cos(phi);

            vertices.push(x, y, z);
            coneTypes.push(1);

            if (i < hemisphereStacks && j < hemisphereSectors) {
              const current =
                yellowHemisphereStartIndex + i * (hemisphereSectors + 1) + j;
              const next =
                yellowHemisphereStartIndex +
                (i + 1) * (hemisphereSectors + 1) +
                j;
              const currentNext =
                yellowHemisphereStartIndex +
                i * (hemisphereSectors + 1) +
                (j + 1);
              const nextNext =
                yellowHemisphereStartIndex +
                (i + 1) * (hemisphereSectors + 1) +
                (j + 1);

              indices.push(current, currentNext, next);
              indices.push(currentNext, nextNext, next);
            }
          }
        }

        return {
          vertices,
          coneTypes,
          indices,
        };
      };

      // Generate geometry once
      const geometry = generateGeometry();

      // Setup buffers
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(geometry.vertices),
        gl.STATIC_DRAW
      );

      gl.bindBuffer(gl.ARRAY_BUFFER, coneTypeBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(geometry.coneTypes),
        gl.STATIC_DRAW
      );

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(geometry.indices),
        gl.STATIC_DRAW
      );

      const animate = (ts) => {
        animationIdRef.current = requestAnimationFrame(animate);

        if (!isPlaying) {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          if (lastTsRef.current !== null) {
            accumulatedSecRef.current = 0;
            lastTsRef.current = null;
          }
          return;
        }

        // Update time
        if (lastTsRef.current == null) {
          lastTsRef.current = ts;
          accumulatedSecRef.current = 0;
        }

        const dtSec = lastTsRef.current
          ? Math.min(0.1, (ts - lastTsRef.current) / 1000)
          : 0;
        lastTsRef.current = ts;
        accumulatedSecRef.current += dtSec;

        // Sync with anchor
        if (anchorEl?.getBoundingClientRect) {
          const rect = anchorEl.getBoundingClientRect();
          anchorRectRef.current = {
            width: rect.width,
            height: rect.height,
          };
          const dpr = getDevicePixelRatio();
          offsetRef.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };

          // Compute metrics if not done yet
          if (!metricsRef.current && anchorRectRef.current) {
            const baseRect = {
              width: anchorRectRef.current.width,
              height: anchorRectRef.current.height,
              left: -anchorRectRef.current.width / 2,
              top: -anchorRectRef.current.height / 2,
            };
            const globalConfig = {
              ellipse: { b: 8.5, a: 37 },
            };
            metricsRef.current = sparkAnimation.computeSparkMetrics(
              SPARK_PATH,
              globalConfig,
              baseRect,
              0,
              0
            );
          }
        }

        if (!metricsRef.current) {
          return;
        }

        // Calculate position along path
        const durationSec = SPARK_PATH.animationTimeMs / 1000.0;
        const elapsed = Math.max(
          0,
          accumulatedSecRef.current - SPARK_PATH.delay / 1000.0
        );
        const normalizedTime = Math.min(1.0, elapsed / durationSec);
        const easedT = applyEasingSpark(normalizedTime);

        const metrics = metricsRef.current;
        const thetaStart = 0.0;
        const thetaEnd = metrics.actualThetaEnd || metrics.thetaEndLocal;
        const theta = thetaStart + (thetaEnd - thetaStart) * easedT;

        const [x, y] = getEllipsePosition2D(
          theta,
          metrics.a,
          metrics.b,
          metrics.rotAngle,
          offsetRef.current.x,
          offsetRef.current.y,
          metrics.ellipseTiltDeg,
          metrics.ellipseRotationDeg
        );

        // Calculate direction for rotation (hemisphere/head should point in direction of travel)
        const thetaNext = theta + 0.01;
        const [xNext, yNext] = getEllipsePosition2D(
          thetaNext,
          metrics.a,
          metrics.b,
          metrics.rotAngle,
          offsetRef.current.x,
          offsetRef.current.y,
          metrics.ellipseTiltDeg,
          metrics.ellipseRotationDeg
        );
        const dx = xNext - x;
        const dy = yNext - y;
        const angle = Math.atan2(dy, dx);

        // Calculate bend angle based on path curvature
        // Get positions ahead and behind to calculate curvature
        const stepSize = 0.05;
        const thetaPrev = theta - stepSize;
        const thetaAhead = theta + stepSize;
        
        const [xPrev, yPrev] = getEllipsePosition2D(
          thetaPrev,
          metrics.a,
          metrics.b,
          metrics.rotAngle,
          offsetRef.current.x,
          offsetRef.current.y,
          metrics.ellipseTiltDeg,
          metrics.ellipseRotationDeg
        );
        
        const [xAhead, yAhead] = getEllipsePosition2D(
          thetaAhead,
          metrics.a,
          metrics.b,
          metrics.rotAngle,
          offsetRef.current.x,
          offsetRef.current.y,
          metrics.ellipseTiltDeg,
          metrics.ellipseRotationDeg
        );
        
        // Calculate direction vectors
        const dirPrev = Math.atan2(y - yPrev, x - xPrev);
        const dirAhead = Math.atan2(yAhead - y, xAhead - x);
        
        // Calculate curvature (angle change per unit distance)
        let angleChange = dirAhead - dirPrev;
        // Normalize to [-PI, PI]
        while (angleChange > Math.PI) angleChange -= 2 * Math.PI;
        while (angleChange < -Math.PI) angleChange += 2 * Math.PI;
        
        // Calculate distance traveled
        const distPrev = Math.sqrt((x - xPrev) ** 2 + (y - yPrev) ** 2);
        const distAhead = Math.sqrt((xAhead - x) ** 2 + (yAhead - y) ** 2);
        const avgDist = (distPrev + distAhead) / 2;
        
        // Curvature = angle change / distance (in radians per pixel)
        const curvature = avgDist > 0.001 ? angleChange / avgDist : 0;
        
        // Bend angle: curvature * object length
        // The shader expects bendAngle in radians, where positive bends upward (in Y direction)
        // We want to bend in the direction of the curve, so we use the curvature
        const bendAngle = curvature * HEIGHT * SCALE;

        // Render (exact same as ConeViewer renderCone)
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        if (resolutionLocation) {
          gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        }
        if (devicePixelRatioLocation) {
          gl.uniform1f(devicePixelRatioLocation, getDevicePixelRatio());
        }
        if (scaleLocation) {
          gl.uniform1f(scaleLocation, SCALE);
        }
        if (baseRadiusLocation) {
          gl.uniform1f(baseRadiusLocation, BASE_RADIUS);
        }
        if (heightLocation) {
          gl.uniform1f(heightLocation, HEIGHT);
        }
        if (whiteRadiusRatioLocation) {
          gl.uniform1f(whiteRadiusRatioLocation, WHITE_RADIUS_RATIO);
        }
        if (yellowRadiusRatioLocation) {
          gl.uniform1f(yellowRadiusRatioLocation, YELLOW_RADIUS_RATIO);
        }
        if (rotateXLocation) {
          gl.uniform1f(rotateXLocation, 0);
        }
        if (rotateYLocation) {
          gl.uniform1f(rotateYLocation, 0);
        }
        if (rotateZLocation) {
          // Rotate so hemisphere (head) points in direction of travel
          // Hemisphere is at z=0, so we rotate around Z to align with path direction
          gl.uniform1f(rotateZLocation, angle + Math.PI / 2);
        }
        if (bendAngleLocation) {
          // Apply bend angle to follow path curvature (in radians)
          // Clamp to reasonable range to avoid extreme bending
          const clampedBendAngle = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, bendAngle));
          gl.uniform1f(bendAngleLocation, clampedBendAngle);
        }
        if (positionOffsetLocation) {
          // x, y are in screen coordinates (CSS pixels)
          // u_resolution is in device pixels, and shader multiplies by DPR
          // So we need to provide offset in device pixels
          const dpr = getDevicePixelRatio();
          const canvasCenterX = canvas.width / 2; // Device pixels
          const canvasCenterY = canvas.height / 2; // Device pixels
          // Convert screen coordinates to device pixels
          const offsetX = (x * dpr) - canvasCenterX;
          const offsetY = (y * dpr) - canvasCenterY;
          gl.uniform2f(positionOffsetLocation, offsetX, offsetY);
        }
        if (glowRadiusLocation) {
          gl.uniform1f(glowRadiusLocation, 10.0);
        }
        if (glowSpreadLocation) {
          gl.uniform1f(glowSpreadLocation, 2.0);
        }
        if (glowColorLocation) {
          gl.uniform3f(glowColorLocation, 0.996, 0.996, 0.318);
        }

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(coneTypeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, coneTypeBuffer);
        gl.vertexAttribPointer(coneTypeLocation, 1, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        gl.drawElements(
          gl.TRIANGLES,
          geometry.indices.length,
          gl.UNSIGNED_SHORT,
          0
        );
      };

      animationIdRef.current = requestAnimationFrame(animate);

      return () => {
        window.removeEventListener("resize", resizeCanvas);
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
        const gl = glRef.current;
        if (gl) {
          Object.values(buffersRef.current).forEach((buffer) => {
            if (buffer) gl.deleteBuffer(buffer);
          });
          if (vertexShader) {
            gl.deleteShader(vertexShader);
          }
          if (fragmentShader) {
            gl.deleteShader(fragmentShader);
          }
          if (program) {
            gl.deleteProgram(program);
          }
        }
      };
    } catch (error) {
      console.error("WebGL initialization error:", error);
      return () => {};
    }
  }, [anchorEl, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

