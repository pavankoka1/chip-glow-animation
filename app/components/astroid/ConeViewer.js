"use client";

import { useEffect, useRef } from "react";
import {
  createProgram,
  createShader,
  getDevicePixelRatio,
} from "../webgl/webgl/webglUtils";
import { fragmentShaderSource, vertexShaderSource } from "./coneShaders";

export default function ConeViewer({
  scale = 20,
  baseRadius = 7.0,
  height = 74.0,
  whiteRadiusRatio = 0.6,
  yellowRadiusRatio = 0.4,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  bendAngle = 0,
  positionOffset = [0, 0],
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
      const positionOffsetLocation = gl.getUniformLocation(program, "u_positionOffset");
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
        if (rotateXLocation) {
          gl.uniform1f(rotateXLocation, (rotateX * Math.PI) / 180);
        }
        if (rotateYLocation) {
          gl.uniform1f(rotateYLocation, (rotateY * Math.PI) / 180);
        }
        if (rotateZLocation) {
          gl.uniform1f(rotateZLocation, (rotateZ * Math.PI) / 180);
        }
        if (bendAngleLocation) {
          gl.uniform1f(bendAngleLocation, (bendAngle * Math.PI) / 180);
        }
        if (positionOffsetLocation) {
          gl.uniform2f(positionOffsetLocation, positionOffset[0], positionOffset[1]);
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
            const currentRadius = baseRadius * (1 - u);

            for (let j = 0; j <= sectors; j++) {
              const theta = (j / sectors) * 2 * Math.PI;
              const x = currentRadius * Math.cos(theta);
              const y = currentRadius * Math.sin(theta);
              const z = height * u;

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
          vertices.push(0, 0, height);
          coneTypes.push(coneType);
          vertexIndex++;

          const baseStartIndex = vertexIndex;
          for (let j = 0; j <= sectors; j++) {
            const theta = (j / sectors) * 2 * Math.PI;
            const x = baseRadius * Math.cos(theta);
            const y = baseRadius * Math.sin(theta);
            const z = height;
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
        const whiteHemisphereRadius = baseRadius * whiteRadiusRatio;
        const whiteHemisphereStartIndex = vertexIndex;

        for (let i = 0; i <= hemisphereStacks; i++) {
          const phi = Math.PI / 2 - (i / hemisphereStacks) * (Math.PI / 2);
          const currentRadius = whiteHemisphereRadius * Math.sin(phi);

          for (let j = 0; j <= hemisphereSectors; j++) {
            const theta = (j / hemisphereSectors) * 2 * Math.PI;
            const x = currentRadius * Math.cos(theta);
            const y = currentRadius * Math.sin(theta);
            // Hemisphere at base (z=0), extending downward (negative z)
            const z = -whiteHemisphereRadius * Math.cos(phi);

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
          baseRadius * (whiteRadiusRatio + yellowRadiusRatio);
        const yellowHemisphereStartIndex = vertexIndex;

        for (let i = 0; i <= hemisphereStacks; i++) {
          const phi = Math.PI / 2 - (i / hemisphereStacks) * (Math.PI / 2);
          const currentRadius = yellowHemisphereRadius * Math.sin(phi);

          for (let j = 0; j <= hemisphereSectors; j++) {
            const theta = (j / hemisphereSectors) * 2 * Math.PI;
            const x = currentRadius * Math.cos(theta);
            const y = currentRadius * Math.sin(theta);
            // Hemisphere at base (z=0), extending downward (negative z)
            const z = -yellowHemisphereRadius * Math.cos(phi);

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

        vertexIndex = vertices.length / 3;

        const positionArray = new Float32Array(vertices);
        const coneTypeArray = new Float32Array(coneTypes);
        const indexArray = new Uint16Array(indices);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.position);
        gl.bufferData(gl.ARRAY_BUFFER, positionArray, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.coneType);
        gl.bufferData(gl.ARRAY_BUFFER, coneTypeArray, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(coneTypeLocation);
        gl.vertexAttribPointer(coneTypeLocation, 1, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersRef.current.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);

        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      };

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
      return () => {};
    }
  }, [
    scale,
    baseRadius,
    height,
    whiteRadiusRatio,
    yellowRadiusRatio,
    rotateX,
    rotateY,
    rotateZ,
    bendAngle,
    positionOffset,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
