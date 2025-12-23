"use client";

import { useEffect, useRef } from "react";
import {
  createProgram,
  createShader,
  getDevicePixelRatio,
} from "../webgl/webgl/webglUtils";
import { fragmentShaderSource, vertexShaderSource } from "./simpleConeShaders";

export default function SparkViewer({
  config,
  globalConfig,
  scale = 15,
  sparkConfig = {},
}) {
  const {
    tailRadius = 0.75,
    headRadius = 7.0,
    tipRadius = 0.5,
    tipWidth = 0.1,
    whiteTipRadius = 0.5,
    yellowTipRadius = 0.5,
    whiteRadiusRatio = 0.6,
    yellowRadiusRatio = 0.4,
    whiteHemisphereBaseRatio = null, // If set, overrides whiteRadiusRatio for hemisphere base
    yellowHemisphereBaseRatio = null, // If set, overrides (whiteRadiusRatio + yellowRadiusRatio) for hemisphere base
    whiteConeHeightExtension = 0.0, // Extension factor for white cone height (0.0 to 1.0, as fraction of path length)
    glowRadius = 10.0,
    glowSpread = 2.0,
    glowColor = "#FEFE51",
    rotateX = 0,
    rotateY = 0,
    rotateZ = 0,
  } = sparkConfig;
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const buffersRef = useRef({
    position: null,
    alongPath: null,
    radiusOffset: null,
    coneType: null,
    index: null,
  });
  const attribsRef = useRef({
    position: null,
    alongPath: null,
    radiusOffset: null,
    coneType: null,
  });
  const uniformsRef = useRef({
    resolution: null,
    devicePixelRatio: null,
    whiteRadiusRatio: null,
    yellowRadiusRatio: null,
    glowRadius: null,
    headRadius: null,
    tailRadius: null,
    pathLength: null,
  });
  const devicePixelRatioRef = useRef(getDevicePixelRatio());
  const bufferRefs = useRef({
    positions: null,
    alongPath: null,
    radiusOffset: null,
    coneType: null,
    indices: null,
    maxVertices: 0,
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
      const alongPathLocation = gl.getAttribLocation(program, "a_alongPath");
      const radiusOffsetLocation = gl.getAttribLocation(
        program,
        "a_radiusOffset"
      );
      const coneTypeLocation = gl.getAttribLocation(program, "a_coneType");

      const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
      const devicePixelRatioLocation = gl.getUniformLocation(
        program,
        "u_devicePixelRatio"
      );
      const whiteRadiusRatioLocation = gl.getUniformLocation(
        program,
        "u_whiteRadiusRatio"
      );
      const yellowRadiusRatioLocation = gl.getUniformLocation(
        program,
        "u_yellowRadiusRatio"
      );
      const glowRadiusLocation = gl.getUniformLocation(program, "u_glowRadius");
      const glowSpreadLocation = gl.getUniformLocation(program, "u_glowSpread");
      const headRadiusLocation = gl.getUniformLocation(program, "u_headRadius");
      const tailRadiusLocation = gl.getUniformLocation(program, "u_tailRadius");
      const tipRadiusLocation = gl.getUniformLocation(program, "u_tipRadius");
      const tipWidthLocation = gl.getUniformLocation(program, "u_tipWidth");
      const rotateXLocation = gl.getUniformLocation(program, "u_rotateX");
      const rotateYLocation = gl.getUniformLocation(program, "u_rotateY");
      const rotateZLocation = gl.getUniformLocation(program, "u_rotateZ");
      const glowColorLocation = gl.getUniformLocation(program, "u_glowColor");

      attribsRef.current = {
        position: positionLocation,
        alongPath: alongPathLocation,
        radiusOffset: radiusOffsetLocation,
        coneType: coneTypeLocation,
      };

      uniformsRef.current = {
        resolution: resolutionLocation,
        devicePixelRatio: devicePixelRatioLocation,
        whiteRadiusRatio: whiteRadiusRatioLocation,
        yellowRadiusRatio: yellowRadiusRatioLocation,
        glowRadius: glowRadiusLocation,
        glowSpread: glowSpreadLocation,
        headRadius: headRadiusLocation,
        tailRadius: tailRadiusLocation,
        tipRadius: tipRadiusLocation,
        tipWidth: tipWidthLocation,
        rotateX: rotateXLocation,
        rotateY: rotateYLocation,
        rotateZ: rotateZLocation,
        glowColor: glowColorLocation,
      };

      const positionBuffer = gl.createBuffer();
      const alongPathBuffer = gl.createBuffer();
      const radiusOffsetBuffer = gl.createBuffer();
      const coneTypeBuffer = gl.createBuffer();
      const indexBuffer = gl.createBuffer();

      buffersRef.current = {
        position: positionBuffer,
        alongPath: alongPathBuffer,
        radiusOffset: radiusOffsetBuffer,
        coneType: coneTypeBuffer,
        index: indexBuffer,
      };

      // Enable blending
      // Use normal alpha blending for white/yellow, additive for glow
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Normal alpha blending

      // Disable back-face culling to ensure cap renders correctly
      gl.disable(gl.CULL_FACE);

      const resizeCanvas = () => {
        const dpr = getDevicePixelRatio();
        devicePixelRatioRef.current = dpr;
        const width = window.innerWidth;
        const height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        gl.viewport(0, 0, canvas.width, canvas.height);
        if (program && programRef.current) {
          gl.useProgram(program);
          if (uniformsRef.current.resolution) {
            gl.uniform2f(
              uniformsRef.current.resolution,
              canvas.width,
              canvas.height
            );
          }
          if (uniformsRef.current.devicePixelRatio) {
            gl.uniform1f(uniformsRef.current.devicePixelRatio, dpr);
          }
        }
      };

      resizeCanvas();

      const handleResize = () => {
        resizeCanvas();
        renderSpark();
      };
      window.addEventListener("resize", handleResize);

      const renderSpark = () => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        // Straight horizontal path (no bend)
        const pathLength = 74; // Total path length in base units
        const pathSegments = 60; // Number of cross-sections along the path
        const pathPoints = [];

        // Generate straight horizontal path
        // For white cone, extend the path forward to increase cone height
        // This makes the entire cone longer, not just bulging in the middle
        const pathExtension = whiteConeHeightExtension * pathLength; // Extension in base units

        for (let i = 0; i <= pathSegments; i++) {
          const t = i / pathSegments; // 0 (tail) to 1 (head)
          // Extend path forward proportionally - more extension closer to head
          const extensionFactor = t; // 0 at tail, 1 at head
          const x =
            -pathLength / 2 + pathLength * t + pathExtension * extensionFactor; // Left to right + extension
          const y = 0; // Straight horizontal
          pathPoints.push({ x, y, t });
        }

        // Use ratios directly - they should represent proportions of the total radius
        // whiteRadiusRatio: portion of radius that is white (0-1)
        // yellowRadiusRatio: additional portion that is yellow (0-1)
        // Total core = whiteRadiusRatio + yellowRadiusRatio (should be <= 1.0)

        // Convert glow color to RGB
        const glowColorRgb = [
          parseInt(glowColor.slice(1, 3), 16) / 255.0,
          parseInt(glowColor.slice(3, 5), 16) / 255.0,
          parseInt(glowColor.slice(5, 7), 16) / 255.0,
        ];

        // Simple hemisphere cap - no complex logging needed

        // Generate simple 2D cone geometry (vertical cross-sections)
        // Each cross-section has 2 vertices: top (+1) and bottom (-1)
        const vertices = [];
        const indices = [];
        let vertexIndex = 0;

        // Store cap start indices for reverse rendering order
        const capStartIndices = {};

        // Generate vertices for 3 layers: white (0), yellow (1), glow (2)
        for (let coneType = 0; coneType < 3; coneType++) {
          const coneStartIndex = vertexIndex;

          // Main body - both cones extend to the same end point
          for (let i = 0; i < pathPoints.length; i++) {
            const pathPoint = pathPoints[i];
            const pathX = centerX + pathPoint.x * scale;
            const pathY = centerY + pathPoint.y * scale;

            // For cone body, use normal alongPath (0 to 1)
            const alongPath = pathPoint.t; // 0 to 1 for cone body

            // Top vertex (radiusOffset = 1.0)
            vertices.push(
              pathX,
              pathY,
              alongPath, // alongPath (0 to 1)
              1.0, // radiusOffset (top)
              coneType
            );

            // Bottom vertex (radiusOffset = -1.0)
            vertices.push(
              pathX,
              pathY,
              alongPath,
              -1.0, // radiusOffset (bottom)
              coneType
            );

            // Log white cone end position
            if (i === pathPoints.length - 1 && coneType < 0.5) {
              const layerHeadRadius = headRadius * whiteRadiusRatio;
              const layerHeadRadiusScaled = layerHeadRadius * scale;
              const topY = pathY + layerHeadRadiusScaled;
              const bottomY = pathY - layerHeadRadiusScaled;
              console.log(
                `WHITE_CONE_END: pathX=${pathX.toFixed(
                  2
                )}, pathY=${pathY.toFixed(2)}, topY=${topY.toFixed(
                  2
                )}, bottomY=${bottomY.toFixed(2)}, heightY=${(
                  2 * layerHeadRadiusScaled
                ).toFixed(2)}`
              );
            }

            // Create quad connecting this cross-section to the next
            if (i < pathPoints.length - 1) {
              const currentTop = coneStartIndex + i * 2;
              const currentBottom = currentTop + 1;
              const nextTop = currentTop + 2;
              const nextBottom = currentTop + 3;

              // Simple quad: two triangles
              indices.push(currentTop, currentBottom, nextTop);
              indices.push(currentBottom, nextBottom, nextTop);
            }

            vertexIndex += 2;
          }

          // Store information for cap generation (we'll generate caps in reverse order)
          if (coneType < 2) {
            capStartIndices[coneType] = {
              coneStartIndex,
              lastTop: coneStartIndex + (pathPoints.length - 1) * 2,
              lastBottom: coneStartIndex + (pathPoints.length - 1) * 2 + 1,
            };
          }
        }

        // Generate caps in reverse order (yellow first, then white) so white renders on top
        for (let coneType = 1; coneType >= 0; coneType--) {
          const capInfo = capStartIndices[coneType];
          if (!capInfo) continue;

          // Calculate layer-specific values for logging
          const layerName = coneType < 0.5 ? "white" : "yellow";
          const layerHeadRadius =
            coneType < 0.5
              ? headRadius * whiteRadiusRatio
              : headRadius * (whiteRadiusRatio + yellowRadiusRatio);

          // Generate proper 3D hemisphere using parametric equations
          // Generate with headRadiusScaled for geometry, shader will scale by ratio
          // This ensures the hemisphere shape is correct and matches shader expectations
          const sectors = 36; // Longitude divisions (circular cross-section)
          const stacks = 18; // Latitude divisions (from pole to equator)
          const headRadiusScaled = headRadius * scale; // Shader uses this (140)

          // Log key values for debugging
          const layerRatio =
            coneType < 0.5
              ? whiteRadiusRatio
              : whiteRadiusRatio + yellowRadiusRatio;
          const layerRadius = headRadiusScaled * layerRatio;

          const headX = centerX + pathPoints[pathPoints.length - 1].x * scale;
          const headY = centerY + pathPoints[pathPoints.length - 1].y * scale;
          const lastTop = capInfo.lastTop;
          const lastBottom = capInfo.lastBottom;
          const capStartIndex = vertexIndex;

          // Log cone end vertex positions for white layer
          if (coneType < 0.5) {
            const layerHeadRadius = headRadius * whiteRadiusRatio;
            const layerHeadRadiusScaled = layerHeadRadius * scale;
            const lastTopY = headY + layerHeadRadiusScaled; // radiusOffset = 1.0
            const lastBottomY = headY - layerHeadRadiusScaled; // radiusOffset = -1.0
            console.log(
              `WHITE_CONE_END_VERTICES: lastTopY=${lastTopY.toFixed(
                2
              )}, lastBottomY=${lastBottomY.toFixed(
                2
              )}, vertexIndices: lastTop=${lastTop}, lastBottom=${lastBottom}`
            );
          }

          // Calculate baseRatio for this hemisphere (before it's used)
          let baseRatio;
          if (coneType < 0.5) {
            // White hemisphere
            baseRatio =
              whiteHemisphereBaseRatio !== null &&
              whiteHemisphereBaseRatio !== undefined
                ? whiteHemisphereBaseRatio
                : whiteRadiusRatio;
          } else {
            // Yellow hemisphere
            baseRatio =
              yellowHemisphereBaseRatio !== null &&
              yellowHemisphereBaseRatio !== undefined
                ? yellowHemisphereBaseRatio
                : whiteRadiusRatio + yellowRadiusRatio;
          }

          // Reuse cone's lastTop and lastBottom vertices for perfect connection
          // This ensures the hemisphere equator shares vertices with the cone end
          const useLastTopBottom = true; // Reuse cone end vertices for seamless connection

          // Calculate expected Y-axis height for this layer
          const layerHeadRadiusScaled = layerHeadRadius * scale;
          // baseRatio is already calculated above (line 377)

          const baseRadiusScaled = headRadiusScaled * baseRatio;
          const layerRadiusScaled = headRadiusScaled * layerRatio;
          const scaleFactor = baseRatio / layerRatio;
          // At equator, we use layerRadius to match cone end, so expected extents match cone end
          const expectedTopY = headY + layerRadiusScaled;
          const expectedBottomY = headY - layerRadiusScaled;
          const expectedHeightY = 2 * layerRadiusScaled;

          // Log white hemisphere start position
          if (coneType < 0.5) {
            const layerHeadRadius = headRadius * whiteRadiusRatio;
            const layerHeadRadiusScaled = layerHeadRadius * scale;
            const coneEndTopY = headY + layerHeadRadiusScaled;
            const coneEndBottomY = headY - layerHeadRadiusScaled;
            const gapTop = coneEndTopY - expectedTopY;
            const gapBottom = expectedBottomY - coneEndBottomY;
            console.log(
              `WHITE_HEMISPHERE_START: headX=${headX.toFixed(
                2
              )}, headY=${headY.toFixed(
                2
              )}, baseRadiusScaled=${baseRadiusScaled.toFixed(
                2
              )}, expectedTopY=${expectedTopY.toFixed(
                2
              )}, expectedBottomY=${expectedBottomY.toFixed(
                2
              )}, coneEndTopY=${coneEndTopY.toFixed(
                2
              )}, coneEndBottomY=${coneEndBottomY.toFixed(
                2
              )}, gapTop=${gapTop.toFixed(2)}, gapBottom=${gapBottom.toFixed(
                2
              )}, useLastTopBottom=${useLastTopBottom}`
            );
          }

          // Initialize Y extents tracking for this hemisphere
          if (!window.hemisphereYExtents) {
            window.hemisphereYExtents = {};
          }
          window.hemisphereYExtents[layerName] = {
            minY: Infinity,
            maxY: -Infinity,
          };

          const pathDirectionX = 1.0; // Path goes left to right

          const sectorStep = (2 * Math.PI) / sectors;
          const stackStep = Math.PI / 2 / stacks; // 0 to π/2 (upper hemisphere)

          // Generate hemisphere vertices using parametric equations
          // x = r sin(φ) cos(θ), y = r sin(φ) sin(θ), z = r cos(φ)
          // Where θ (azimuth) ranges from 0 to 2π, φ (polar) ranges from 0 to π/2
          // At equator: if baseRatio matches layerRatio, we skip top/bottom vertices and use lastTop/lastBottom
          // If baseRatio differs, we generate all vertices to avoid steep triangles
          const topSectorIdx = Math.round(sectors / 4); // theta = π/2
          const bottomSectorIdx = Math.round((3 * sectors) / 4); // theta = 3π/2

          for (let i = 0; i <= stacks; i++) {
            const phi = i * stackStep; // 0 to π/2
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            const isEquator = i === stacks;

            for (let j = 0; j <= sectors; j++) {
              const theta = j * sectorStep; // 0 to 2π

              // Skip top and bottom vertices at equator - we'll reuse lastTop and lastBottom
              // This ensures perfect vertex sharing between cone and hemisphere
              const shouldSkipTopBottom =
                isEquator &&
                useLastTopBottom &&
                (j === topSectorIdx || j === bottomSectorIdx);
              if (shouldSkipTopBottom) {
                continue;
              }

              // 3D hemisphere coordinates
              // baseRatio and layerRatio are already calculated above
              const baseRadius = headRadiusScaled * baseRatio;
              const layerRadius = headRadiusScaled * layerRatio; // 84 for white, 140 for yellow

              // Calculate scaleFactor for the entire hemisphere based on baseRatio
              // This scales the entire hemisphere to match the desired base size
              const scaleFactor = baseRatio / layerRatio;

              // At equator, we MUST match the cone end size (layerRadius) for seamless connection
              // Above equator, we use baseRadius to create the smaller base effect
              let y3d, z3d;
              if (isEquator) {
                // At equator: form a perfect circle with radius layerRadius to match cone end
                // This ensures seamless connection - the equator matches the cone end exactly
                // y3d ranges from -layerRadius to +layerRadius as theta goes from 0 to 2π
                y3d = layerRadius * Math.sin(theta);
                z3d = 0; // No forward extension at equator
              } else {
                // Above equator: use baseRadius to create the smaller base effect
                // This creates the taper from cone end size to the desired base size
                // Use the same formula for both white and yellow - yellow works correctly
                y3d = baseRadius * sinPhi * Math.sin(theta);
                z3d = baseRadius * cosPhi; // Forward extension for hemisphere shape
              }

              // Project 3D hemisphere to 2D screen space:
              // - z3d (forward) maps to X offset along path direction
              // - y3d (vertical) maps to vertical offset (radiusOffset)
              // - x3d (horizontal) is not directly visible in 2D view

              // Forward extension along path (z3d is 0 at equator, baseRadius at pole)
              // At equator, ensure we're exactly at headX (no forward extension)
              const forwardDistance = isEquator ? 0 : z3d;
              const capX = headX + forwardDistance * pathDirectionX;
              const capY = headY; // Base Y position, shader handles vertical offset

              // radiusOffset: normalize appropriately
              // IMPORTANT: The shader always uses u_headRadius * u_whiteRadiusRatio for the cap
              // Shader calculates: actualRadius = u_headRadius * u_whiteRadiusRatio = headRadiusScaled * layerRatio
              // Shader calculates: offset = radiusOffset * actualRadius
              let radiusOffset;
              if (isEquator) {
                // At equator: y3d = layerRadius * sin(theta) to match cone end
                // We want: offset = layerRadius * sin(theta)
                // So: radiusOffset = (layerRadius * sin(theta)) / (headRadiusScaled * layerRatio)
                //    radiusOffset = (layerRadius * sin(theta)) / layerRadius = sin(theta)
                radiusOffset = Math.sin(theta);
              } else {
                // Above equator: y3d = baseRadius * sinPhi * sin(theta)
                // We want: offset = baseRadius * sinPhi * sin(theta)
                // So: radiusOffset = (baseRadius * sinPhi * sin(theta)) / (headRadiusScaled * layerRatio)
                //    radiusOffset = (baseRadius * sinPhi * sin(theta)) / layerRadius
                //    radiusOffset = (baseRadius / layerRadius) * sinPhi * sin(theta) = scaleFactor * sinPhi * sin(theta)
                radiusOffset = scaleFactor * sinPhi * Math.sin(theta);
              }

              // At equator, ensure vertices reach the full extent to match cone end
              // We skip exact top/bottom (theta = π/2, 3π/2) and use lastTop/lastBottom,
              // but nearby vertices should reach ±1.0 to ensure seamless connection
              if (isEquator) {
                // Calculate angular distance to top (π/2) or bottom (3π/2)
                const distToTop = Math.min(
                  Math.abs(theta - Math.PI / 2),
                  Math.abs(theta - Math.PI / 2 + 2 * Math.PI),
                  Math.abs(theta - Math.PI / 2 - 2 * Math.PI)
                );
                const distToBottom = Math.min(
                  Math.abs(theta - (3 * Math.PI) / 2),
                  Math.abs(theta - (3 * Math.PI) / 2 + 2 * Math.PI),
                  Math.abs(theta - (3 * Math.PI) / 2 - 2 * Math.PI)
                );
                const minDist = Math.min(distToTop, distToBottom);

                // At equator, we want radiusOffset to reach ±1.0 to match cone end
                // If we're very close to top/bottom (within 1.5 sector steps), ensure we reach the full extent
                if (minDist < sectorStep * 1.5) {
                  const threshold = 0.95;
                  if (Math.abs(radiusOffset) > threshold) {
                    radiusOffset = radiusOffset > 0 ? 1.0 : -1.0;
                  }
                }
              }

              // Calculate actual Y position that will be rendered
              // Shader calculates: finalY = capY + (radiusOffset * actualRadius)
              // where actualRadius = headRadiusScaled * layerRatio (shader always uses layerRatio)
              // So: finalY = headY + radiusOffset * (headRadiusScaled * layerRatio)
              // At equator: radiusOffset = sin(theta)
              // So: finalY = headY + sin(theta) * (headRadiusScaled * layerRatio)
              //            = headY + layerRadius * sin(theta) ✓ (matches cone end)
              // Above equator: radiusOffset = scaleFactor * sinPhi * sin(theta)
              // So: finalY = headY + scaleFactor * sinPhi * sin(theta) * layerRadius
              //            = headY + (baseRadius/layerRadius) * sinPhi * sin(theta) * layerRadius
              //            = headY + baseRadius * sinPhi * sin(theta) ✓
              const actualY = headY + radiusOffset * layerRadius;

              // Log white hemisphere equator vertices to check connection
              if (isEquator && coneType < 0.5) {
                // Log key points: top (j near topSectorIdx), middle (j=0), bottom (j near bottomSectorIdx)
                const isNearTop =
                  Math.abs(j - topSectorIdx) <= 1 ||
                  Math.abs(j - topSectorIdx + sectors) <= 1;
                const isNearBottom =
                  Math.abs(j - bottomSectorIdx) <= 1 ||
                  Math.abs(j - bottomSectorIdx + sectors) <= 1;
                if (j === 0 || isNearTop || isNearBottom || j <= 2) {
                  console.log(
                    `WHITE_HEMISPHERE_EQUATOR: j=${j}, theta=${theta.toFixed(
                      3
                    )}, capX=${capX.toFixed(2)}, capY=${capY.toFixed(
                      2
                    )}, radiusOffset=${radiusOffset.toFixed(
                      3
                    )}, actualY=${actualY.toFixed(
                      2
                    )}, vertexIndex=${vertexIndex}`
                  );
                }
              }

              // Track min/max Y for hemisphere tip
              if (
                window.hemisphereYExtents &&
                window.hemisphereYExtents[layerName]
              ) {
                window.hemisphereYExtents[layerName].minY = Math.min(
                  window.hemisphereYExtents[layerName].minY,
                  actualY
                );
                window.hemisphereYExtents[layerName].maxY = Math.max(
                  window.hemisphereYExtents[layerName].maxY,
                  actualY
                );
              }

              // alongPath > 1.0 indicates cap
              const alongPath = 1.1; // Slightly > 1.0 to mark as cap

              vertices.push(capX, capY, alongPath, radiusOffset, coneType);
              vertexIndex++;
            }
          }

          // Generate indices for triangle mesh
          // Each stack forms a ring, but equator may have fewer vertices if we skip top/bottom
          // Only skip top/bottom if baseRatio matches layerRatio (to avoid steep triangles)
          const verticesPerStack = [];
          let currentVertexIdx = capStartIndex;

          for (let i = 0; i <= stacks; i++) {
            const isEquator = i === stacks;
            // Equator skips top/bottom vertices (reusing lastTop/lastBottom)
            const count =
              isEquator && useLastTopBottom
                ? sectors - 1 // Equator skips 2 vertices (top/bottom), reuses lastTop/lastBottom
                : sectors + 1; // Full ring
            verticesPerStack.push({
              start: currentVertexIdx,
              count: count,
              isEquator: isEquator,
              useLastTopBottom: isEquator && useLastTopBottom,
            });
            currentVertexIdx += count;
          }

          // Connect stacks with quads (two triangles)
          for (let i = 0; i < stacks; i++) {
            const lowerStack = verticesPerStack[i];
            const upperStack = verticesPerStack[i + 1];

            // Map sector index to actual vertex index
            const getVertexIdx = (stack, sectorIdx) => {
              if (!stack.isEquator || !stack.useLastTopBottom) {
                return stack.start + sectorIdx;
              }
              // Equator with lastTop/lastBottom: skip topSectorIdx and bottomSectorIdx
              let actualIdx = stack.start;
              for (let s = 0; s < sectorIdx; s++) {
                if (s !== topSectorIdx && s !== bottomSectorIdx) {
                  actualIdx++;
                }
              }
              return actualIdx;
            };

            for (let j = 0; j < sectors; j++) {
              let lowerIdx = getVertexIdx(lowerStack, j);
              let upperIdx = getVertexIdx(upperStack, j);
              let lowerNextIdx = getVertexIdx(
                lowerStack,
                (j + 1) % (sectors + 1)
              );
              let upperNextIdx = getVertexIdx(
                upperStack,
                (j + 1) % (sectors + 1)
              );

              // Handle special cases at equator where we use lastTop/lastBottom
              // This ensures perfect vertex sharing between cone and hemisphere
              if (upperStack.isEquator && upperStack.useLastTopBottom) {
                // Handle upperIdx (current sector)
                if (j === topSectorIdx) {
                  upperIdx = lastTop;
                } else if (j === bottomSectorIdx) {
                  upperIdx = lastBottom;
                }
                // Handle upperNextIdx (next sector)
                if ((j + 1) % (sectors + 1) === topSectorIdx) {
                  upperNextIdx = lastTop;
                } else if ((j + 1) % (sectors + 1) === bottomSectorIdx) {
                  upperNextIdx = lastBottom;
                }
              }

              // First triangle of quad
              if (i !== 0 || j !== 0) {
                indices.push(lowerIdx, upperIdx, lowerNextIdx);
              }
              // Second triangle of quad
              indices.push(lowerNextIdx, upperIdx, upperNextIdx);
            }
          }

          // The hemisphere stacks are already connected, and we're reusing lastTop/lastBottom
          // The stack connection loop above handles all the necessary triangles
          // No additional connection needed - the hemisphere's own triangle generation
          // already connects the first stack to the equator (which reuses lastTop/lastBottom)

          // The gap is a visual issue - the geometry is correct
          // Cone body ends at lastTop/lastBottom, hemisphere equator reuses them
          // The hemisphere's triangle generation already creates the connection
          // If there's still a gap, it might be a shader rendering issue

          // Log white hemisphere final extents
          if (
            coneType < 0.5 &&
            window.hemisphereYExtents &&
            window.hemisphereYExtents[layerName]
          ) {
            const extents = window.hemisphereYExtents[layerName];
            const tipHeightY = extents.maxY - extents.minY;
            console.log(
              `WHITE_HEMISPHERE_END: headX=${headX.toFixed(
                2
              )}, minY=${extents.minY.toFixed(2)}, maxY=${extents.maxY.toFixed(
                2
              )}, tipHeightY=${tipHeightY.toFixed(2)}`
            );
            // Reset for next render
            delete window.hemisphereYExtents[layerName];
          }
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (vertices.length === 0) {
          return;
        }

        // Prepare buffer data
        // Each vertex has 5 floats: x, y, alongPath, radiusOffset, coneType
        const vertexCount = vertices.length / 5;
        const positions = new Float32Array(vertexCount * 2);
        const alongPath = new Float32Array(vertexCount);
        const radiusOffset = new Float32Array(vertexCount);
        const coneType = new Float32Array(vertexCount);

        for (let i = 0; i < vertices.length; i += 5) {
          const vertexIdx = i / 5;
          positions[vertexIdx * 2] = vertices[i]; // x
          positions[vertexIdx * 2 + 1] = vertices[i + 1]; // y
          alongPath[vertexIdx] = vertices[i + 2];
          radiusOffset[vertexIdx] = vertices[i + 3];
          coneType[vertexIdx] = vertices[i + 4];
        }

        const indexArray = new Uint16Array(indices);

        if (!programRef.current) {
          return;
        }

        gl.useProgram(programRef.current);

        if (uniformsRef.current.resolution) {
          gl.uniform2f(
            uniformsRef.current.resolution,
            canvas.width,
            canvas.height
          );
        }
        if (uniformsRef.current.devicePixelRatio) {
          gl.uniform1f(
            uniformsRef.current.devicePixelRatio,
            devicePixelRatioRef.current
          );
        }
        // Set uniforms
        if (uniformsRef.current.whiteRadiusRatio) {
          gl.uniform1f(uniformsRef.current.whiteRadiusRatio, whiteRadiusRatio);
        }
        if (uniformsRef.current.yellowRadiusRatio) {
          gl.uniform1f(
            uniformsRef.current.yellowRadiusRatio,
            yellowRadiusRatio
          );
        }
        if (uniformsRef.current.glowRadius) {
          gl.uniform1f(uniformsRef.current.glowRadius, glowRadius * scale);
        }
        if (uniformsRef.current.headRadius) {
          const headRadiusScaled = headRadius * scale;
          gl.uniform1f(uniformsRef.current.headRadius, headRadiusScaled);
        }
        if (uniformsRef.current.tailRadius) {
          gl.uniform1f(uniformsRef.current.tailRadius, tailRadius * scale);
        }
        if (uniformsRef.current.tipRadius) {
          gl.uniform1f(uniformsRef.current.tipRadius, tipRadius * scale);
        }
        if (uniformsRef.current.tipWidth) {
          gl.uniform1f(uniformsRef.current.tipWidth, tipWidth);
        }
        if (uniformsRef.current.rotateX) {
          gl.uniform1f(uniformsRef.current.rotateX, rotateX);
        }
        if (uniformsRef.current.rotateY) {
          gl.uniform1f(uniformsRef.current.rotateY, rotateY);
        }
        if (uniformsRef.current.rotateZ) {
          gl.uniform1f(uniformsRef.current.rotateZ, rotateZ);
        }
        if (uniformsRef.current.glowSpread) {
          gl.uniform1f(uniformsRef.current.glowSpread, glowSpread);
        }
        if (uniformsRef.current.glowColor) {
          gl.uniform3f(
            uniformsRef.current.glowColor,
            glowColorRgb[0],
            glowColorRgb[1],
            glowColorRgb[2]
          );
        }

        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.position);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attribsRef.current.position);
        gl.vertexAttribPointer(
          attribsRef.current.position,
          2,
          gl.FLOAT,
          false,
          0,
          0
        );

        // Bind alongPath buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.alongPath);
        gl.bufferData(gl.ARRAY_BUFFER, alongPath, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attribsRef.current.alongPath);
        gl.vertexAttribPointer(
          attribsRef.current.alongPath,
          1,
          gl.FLOAT,
          false,
          0,
          0
        );

        // Bind radiusOffset buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.radiusOffset);
        gl.bufferData(gl.ARRAY_BUFFER, radiusOffset, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attribsRef.current.radiusOffset);
        gl.vertexAttribPointer(
          attribsRef.current.radiusOffset,
          1,
          gl.FLOAT,
          false,
          0,
          0
        );

        // Bind coneType buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.coneType);
        gl.bufferData(gl.ARRAY_BUFFER, coneType, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attribsRef.current.coneType);
        gl.vertexAttribPointer(
          attribsRef.current.coneType,
          1,
          gl.FLOAT,
          false,
          0,
          0
        );

        // Bind index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersRef.current.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.DYNAMIC_DRAW);

        // Draw all layers in one pass with normal blending
        // The shader handles layer separation
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      };

      // Initial render
      renderSpark();

      return () => {
        window.removeEventListener("resize", handleResize);
        const gl = glRef.current;
        if (gl) {
          if (buffersRef.current.position) {
            gl.deleteBuffer(buffersRef.current.position);
          }
          if (buffersRef.current.alongPath) {
            gl.deleteBuffer(buffersRef.current.alongPath);
          }
          if (buffersRef.current.radiusOffset) {
            gl.deleteBuffer(buffersRef.current.radiusOffset);
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
        bufferRefs.current = {
          positions: null,
          alongPath: null,
          radiusOffset: null,
          coneType: null,
          indices: null,
          maxVertices: 0,
        };
      };
    } catch (error) {
      console.error("WebGL initialization error:", error);
      return () => {
        // Cleanup on error
      };
    }
  }, [config, globalConfig, scale, sparkConfig]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
