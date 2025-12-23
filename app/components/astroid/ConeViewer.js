"use client";

import { useEffect, useRef } from "react";
import {
  createProgram,
  createShader,
  getDevicePixelRatio,
} from "../webgl/webgl/webglUtils";
import { fragmentShaderSource, vertexShaderSource } from "./coneShaders";

/**
 * ConeViewer - Renders a simple 3D right circular cone using parametric equations
 *
 * Parametric equations for the lateral surface:
 * x = (r * (1 - u)) * cos(θ)
 * y = (r * (1 - u)) * sin(θ)
 * z = h * u
 *
 * Where:
 * - θ (azimuthal angle): 0 to 2π
 * - u (height fraction): 0 to 1 (apex at u=0, base at u=1)
 * - r = base radius
 * - h = height
 */
export default function ConeViewer({
  scale = 20,
  baseRadius = 7.0,
  height = 74.0,
  whiteRadiusRatio = 0.6,
  yellowRadiusRatio = 0.4,
}) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const buffersRef = useRef({
    position: null,
    coneType: null,
    index: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });

    if (!gl) {
      console.error("WebGL not supported");
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

      // Get attribute and uniform locations
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

      const positionBuffer = gl.createBuffer();
      const coneTypeBuffer = gl.createBuffer();
      const indexBuffer = gl.createBuffer();

      buffersRef.current = {
        position: positionBuffer,
        coneType: coneTypeBuffer,
        index: indexBuffer,
      };

      // Enable depth testing for proper 3D rendering
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE); // Show both sides

      const resizeCanvas = () => {
        const dpr = getDevicePixelRatio();
        const width = window.innerWidth;
        const height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        gl.viewport(0, 0, canvas.width, canvas.height);
        if (program && programRef.current) {
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

      const handleResize = () => {
        resizeCanvas();
        renderCone();
      };
      window.addEventListener("resize", handleResize);

      const renderCone = () => {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (!programRef.current) {
          return;
        }

        gl.useProgram(programRef.current);

        // Set uniforms
        if (resolutionLocation) {
          gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        }
        if (devicePixelRatioLocation) {
          gl.uniform1f(devicePixelRatioLocation, getDevicePixelRatio());
        }
        if (scaleLocation) {
          gl.uniform1f(scaleLocation, scale);
        }
        if (baseRadiusLocation) {
          gl.uniform1f(baseRadiusLocation, baseRadius);
        }
        if (heightLocation) {
          gl.uniform1f(heightLocation, height);
        }
        if (whiteRadiusRatioLocation) {
          gl.uniform1f(whiteRadiusRatioLocation, whiteRadiusRatio);
        }
        if (yellowRadiusRatioLocation) {
          gl.uniform1f(yellowRadiusRatioLocation, yellowRadiusRatio);
        }

        // Generate cone geometry using parametric equations
        // x = (r * (1 - u)) * cos(θ)
        // y = (r * (1 - u)) * sin(θ)
        // z = h * u
        //
        // Where:
        // - θ (azimuthal angle): 0 to 2π
        // - u (height fraction): 0 to 1 (apex at u=0, base at u=1)
        // - r = baseRadius
        // - h = height

        const sectors = 36; // Number of divisions around the circle (azimuthal)
        const stacks = 30; // Number of divisions along the height (u parameter)

        // Generate geometry for both white (0) and yellow (1) cones
        const vertices = [];
        const coneTypes = [];
        const indices = [];
        let vertexIndex = 0;

        // Generate both cones
        for (let coneType = 0; coneType < 2; coneType++) {
          const coneStartIndex = vertexIndex;

          // Generate vertices for lateral surface
          for (let i = 0; i <= stacks; i++) {
            const u = i / stacks; // 0 (apex) to 1 (base)
            const currentRadius = baseRadius * (1 - u); // Radius decreases from baseRadius to 0

            for (let j = 0; j <= sectors; j++) {
              const theta = (j / sectors) * 2 * Math.PI; // 0 to 2π

              // Parametric equations
              // Keep original: apex (u=0) at z=0, base (u=1) at z=height
              const x = currentRadius * Math.cos(theta);
              const y = currentRadius * Math.sin(theta);
              const z = height * u; // u=0 gives z=0 (apex), u=1 gives z=height (base)

              vertices.push(x, y, z);
              coneTypes.push(coneType);

              // Create triangles connecting this ring to the next
              if (i < stacks && j < sectors) {
                const current = coneStartIndex + i * (sectors + 1) + j;
                const next = coneStartIndex + (i + 1) * (sectors + 1) + j;
                const currentNext =
                  coneStartIndex + i * (sectors + 1) + (j + 1);
                const nextNext =
                  coneStartIndex + (i + 1) * (sectors + 1) + (j + 1);

                // Two triangles per quad
                indices.push(current, next, currentNext);
                indices.push(currentNext, next, nextNext);
              }
            }
          }

          // Generate base circle (cap at z = height)
          const baseCenterIndex = vertexIndex;
          const baseCenterX = 0;
          const baseCenterY = 0;
          const baseCenterZ = height; // Base at z = height
          vertices.push(baseCenterX, baseCenterY, baseCenterZ);
          coneTypes.push(coneType);
          vertexIndex++;

          // Generate base circle vertices
          const baseStartIndex = vertexIndex;
          for (let j = 0; j <= sectors; j++) {
            const theta = (j / sectors) * 2 * Math.PI;
            const x = baseRadius * Math.cos(theta);
            const y = baseRadius * Math.sin(theta);
            const z = height; // Base at z = height
            vertices.push(x, y, z);
            coneTypes.push(coneType);
            vertexIndex++;
          }

          // Create triangles for base
          for (let j = 0; j < sectors; j++) {
            const v1 = baseStartIndex + j;
            const v2 = baseStartIndex + (j + 1);
            indices.push(baseCenterIndex, v1, v2);
          }

          vertexIndex = vertices.length / 3;
        }

        // Generate hemispheres aligned with cone bases
        // Hemisphere parametric equations:
        // x = r * sin(φ) * cos(θ)
        // y = r * sin(φ) * sin(θ)
        // z = height - r * cos(φ)
        // Where:
        // - θ (azimuthal angle): 0 to 2π
        // - φ (polar angle from +z axis): 0 to π/2 (top half only)
        // - r = hemisphere radius
        // - height = base z position
        // Note: When φ = π/2, z = height (base). When φ = 0, z = height - r (extends toward apex)
        // After z-flip: z = height maps to left (base), z = height - r maps to right
        // The hemisphere will span from left (base) to right (toward apex), which is correct

        const hemisphereSectors = 36; // Number of divisions around the circle (azimuthal)
        const hemisphereStacks = 18; // Number of divisions along the polar angle (φ)

        // Generate white hemisphere (aligned with white cone base)
        const whiteHemisphereRadius = baseRadius * whiteRadiusRatio;
        const whiteHemisphereStartIndex = vertexIndex;

        // Log hemisphere generation
        console.log(
          `WHITE_HEMISPHERE: radius=${whiteHemisphereRadius}, baseZ=${height}, apexZ=${0}`
        );

        // Generate vertices for white hemisphere curved surface
        // Iterate from base (φ = π/2) to top (φ = 0)
        for (let i = 0; i <= hemisphereStacks; i++) {
          const phi = Math.PI / 2 - (i / hemisphereStacks) * (Math.PI / 2); // π/2 (base) to 0 (top)
          const currentRadius = whiteHemisphereRadius * Math.sin(phi);

          for (let j = 0; j <= hemisphereSectors; j++) {
            const theta = (j / hemisphereSectors) * 2 * Math.PI; // 0 to 2π

            // Parametric equations for hemisphere
            // Similar to SparkViewer: hemisphere extends forward from base
            // z3d = r * cos(φ) represents forward extension (0 at equator/base, r at pole/top)
            // In our coordinate system: base is at z=height, forward extension means smaller z
            // Offset of -73.8 positions hemisphere correctly at the base
            // Base (φ=π/2): z = height - r*0 - 73.8 = height - 73.8
            // Top (φ=0): z = height - r*1 - 73.8 = height - r - 73.8
            const x = currentRadius * Math.cos(theta);
            const y = currentRadius * Math.sin(theta);
            const z = height - whiteHemisphereRadius * Math.cos(phi) - 73.8;

            // Log first and last rings
            if ((i === 0 || i === hemisphereStacks) && j === 0) {
              console.log(
                `  Ring ${i}: phi=${phi.toFixed(3)}, z=${z.toFixed(
                  2
                )}, x=${x.toFixed(2)}, y=${y.toFixed(2)}`
              );
            }

            vertices.push(x, y, z);
            coneTypes.push(0); // White hemisphere

            // Create triangles connecting this ring to the next
            // Reverse winding order for hemisphere to face outward correctly
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

              // Two triangles per quad (reversed winding for correct orientation)
              indices.push(current, currentNext, next);
              indices.push(currentNext, nextNext, next);
            }
          }
        }

        vertexIndex = vertices.length / 3;

        // Generate yellow hemisphere (aligned with yellow cone base)
        const yellowHemisphereRadius =
          baseRadius * (whiteRadiusRatio + yellowRadiusRatio);
        const yellowHemisphereStartIndex = vertexIndex;

        // Log hemisphere generation
        console.log(
          `YELLOW_HEMISPHERE: radius=${yellowHemisphereRadius}, baseZ=${height}, apexZ=${0}`
        );

        // Generate vertices for yellow hemisphere curved surface
        // Iterate from base (φ = π/2) to top (φ = 0)
        for (let i = 0; i <= hemisphereStacks; i++) {
          const phi = Math.PI / 2 - (i / hemisphereStacks) * (Math.PI / 2); // π/2 (base) to 0 (top)
          const currentRadius = yellowHemisphereRadius * Math.sin(phi);

          for (let j = 0; j <= hemisphereSectors; j++) {
            const theta = (j / hemisphereSectors) * 2 * Math.PI; // 0 to 2π

            // Parametric equations for hemisphere
            // Similar to SparkViewer: hemisphere extends forward from base
            // z3d = r * cos(φ) represents forward extension (0 at equator/base, r at pole/top)
            // In our coordinate system: base is at z=height, forward extension means smaller z
            // Offset of -73.8 positions hemisphere correctly at the base
            // Base (φ=π/2): z = height - r*0 - 73.8 = height - 73.8
            // Top (φ=0): z = height - r*1 - 73.8 = height - r - 73.8
            const x = currentRadius * Math.cos(theta);
            const y = currentRadius * Math.sin(theta);
            const z = height - yellowHemisphereRadius * Math.cos(phi) - 73.8;

            // Log first and last rings
            if ((i === 0 || i === hemisphereStacks) && j === 0) {
              console.log(
                `  Ring ${i}: phi=${phi.toFixed(3)}, z=${z.toFixed(
                  2
                )}, x=${x.toFixed(2)}, y=${y.toFixed(2)}`
              );
            }

            vertices.push(x, y, z);
            coneTypes.push(1); // Yellow hemisphere

            // Create triangles connecting this ring to the next
            // Reverse winding order for hemisphere to face outward correctly
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

              // Two triangles per quad (reversed winding for correct orientation)
              indices.push(current, currentNext, next);
              indices.push(currentNext, nextNext, next);
            }
          }
        }

        // Prepare buffer data
        const positionArray = new Float32Array(vertices);
        const coneTypeArray = new Float32Array(coneTypes);
        const indexArray = new Uint16Array(indices);

        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.position);
        gl.bufferData(gl.ARRAY_BUFFER, positionArray, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

        // Bind coneType buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.coneType);
        gl.bufferData(gl.ARRAY_BUFFER, coneTypeArray, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(coneTypeLocation);
        gl.vertexAttribPointer(coneTypeLocation, 1, gl.FLOAT, false, 0, 0);

        // Bind index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersRef.current.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);

        // Draw both cones (white first, then yellow on top)
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      };

      // Initial render
      renderCone();

      return () => {
        window.removeEventListener("resize", handleResize);
        const gl = glRef.current;
        if (gl) {
          if (buffersRef.current.position) {
            gl.deleteBuffer(buffersRef.current.position);
          }
          if (buffersRef.current.coneType) {
            gl.deleteBuffer(buffersRef.current.coneType);
          }
          if (buffersRef.current.index) {
            gl.deleteBuffer(buffersRef.current.index);
          }
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
      return () => {
        // Cleanup on error
      };
    }
  }, [scale, baseRadius, height, whiteRadiusRatio, yellowRadiusRatio]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
