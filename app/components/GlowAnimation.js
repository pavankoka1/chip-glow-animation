"use client";

/**
 * GlowAnimation Component
 *
 * EASING FUNCTION: The easing function is located in this file (GlowAnimation.js).
 * Look for the `applyEasing` function around line 46.
 * To change the easing, comment out the current return statement and uncomment
 * the easing function you want to use. The function takes normalized time (0.0-1.0)
 * and returns eased time (0.0-1.0).
 *
 * Available easing options (commented in this file):
 * - Linear (default)
 * - Ease-out sine: 1 - Math.cos((x * Math.PI) / 2)
 * - Ease-in/out sine, cubic, quad, expo, back, elastic
 */

import { useEffect, useRef } from "react";
import useFps from "../hooks/useFps";
import { disposeSpark, drawSpark } from "./animation/Spark";
import {
  computeCirclePathLength,
  disposeSparkCircle,
  drawSparkCircle,
} from "./animation/SparkCircle";
import { CAMERA_DISTANCE, DEFAULT_CONFIG } from "./animation/constants";
import { getAngleForVertex } from "./animation/utils";

export default function GlowAnimation({
  anchorEl,
  config = {},
  isPlaying = false,
  onAnimationComplete,
}) {
  const canvasRef = useRef(null);
  const animationIdRef = [];
  const glRef = useRef(null);
  const positionBufferRef = useRef(null);
  const pathMetricsRef = useRef(new Map());
  const lastTsRef = useRef(null);
  const accumulatedSecRef = useRef(0);
  const loggedPathsRef = useRef(new Set());
  useFps({ sampleSize: 90 });

  const delayToSeconds = (v) =>
    typeof v === "number" && !Number.isNaN(v) ? (v > 20 ? v / 1000 : v) : 0;
  const degToRad = (d) => (d * Math.PI) / 180;

  // Easing functions: takes normalized time (0.0 to 1.0) and returns eased value (0.0 to 1.0)
  // Separate easing for spark and circle animations

  // Easing for Spark animation: ease-out quad (gentle deceleration)
  const applyEasingSpark = (t) => {
    const t1 = 1 - t;
    return 1 - t1 * t1;
  };

  // Easing for Circle animation: ease-in cubic (slow start, very fast at end)
  const applyEasingCircle = (t) => {
    // const t1 = 1 - t;
    // return 1 - t1 * t1;
    // Ease-in cubic: smooth acceleration, very fast at the end
    return t;

    // Alternative: Ease-in expo (extremely fast at end)
    // return t <= 0 ? 0 : Math.pow(2, 10 * (t - 1));
  };

  const cornerPoint = (vertex, rect) => {
    switch (vertex) {
      case "TL":
        return [rect.left, rect.top];
      case "TR":
        return [rect.right, rect.top];
      case "BR":
        return [rect.right, rect.bottom];
      case "BL":
        return [rect.left, rect.bottom];
      default:
        return [rect.right, rect.top];
    }
  };

  // Comprehensive 3D coordinate logging function
  const log3DCoordinates = (
    pathId,
    a,
    b,
    rotAngle,
    rotExtra,
    thetaStart,
    thetaEnd,
    centerX,
    centerY,
    camDist,
    tiltX,
    tiltY,
    depthAmp,
    depthPhase,
    ellipseTiltDeg,
    rect
  ) => {
    console.log("\n" + "=".repeat(80));
    console.log(`📐 3D COORDINATE SYSTEM ANALYSIS - Path ID: ${pathId}`);
    console.log("=".repeat(80));

    // Helper function to convert from internal (screen) coordinates to mathematical coordinates
    // Internal: X+ = right, Y+ = down, Z+ = into screen
    // Mathematical: X+ = right, Y+ = top, Z+ = out of screen
    const toMathCoords = (x, y, z) => [x, -y, -z];

    // 1. Coordinate System Explanation
    console.log("\n📍 COORDINATE SYSTEM:");
    console.log("   X-axis: Horizontal (left = negative, right = positive)");
    console.log("   Y-axis: Vertical (top = positive, bottom = negative)");
    console.log(
      "   Z-axis: Depth (out of screen = positive, into screen = negative)"
    );
    console.log("   Origin (0,0,0): Center of the betspot in 3D space");

    // 2. Betspot Information
    console.log("\n🎯 BETSPOT INFORMATION:");
    if (rect) {
      const betspotCenter3D = [0, 0, 0]; // In 3D local space, center is at origin
      const betspotCenter2D = [centerX, centerY]; // In 2D screen space
      const centerMath = toMathCoords(
        betspotCenter3D[0],
        betspotCenter3D[1],
        betspotCenter3D[2]
      );
      console.log(
        `   Center (3D): [${centerMath[0]}, ${centerMath[1]}, ${centerMath[2]}]`
      );
      console.log(
        `   Center (2D screen): [${betspotCenter2D[0].toFixed(
          2
        )}, ${betspotCenter2D[1].toFixed(2)}]`
      );
      console.log(`   Dimensions: ${rect.width}px × ${rect.height}px`);

      // Calculate betspot vertices in 3D local space (before any transformations)
      // Internal coordinates: Y+ down, so top has negative Y
      const halfWidth = rect.width / 2;
      const halfHeight = rect.height / 2;
      const vertices3DInternal = {
        TL: [-halfWidth, -halfHeight, 0], // Top-Left (internal: Y negative)
        TR: [halfWidth, -halfHeight, 0], // Top-Right (internal: Y negative)
        BR: [halfWidth, halfHeight, 0], // Bottom-Right (internal: Y positive)
        BL: [-halfWidth, halfHeight, 0], // Bottom-Left (internal: Y positive)
      };

      console.log("\n   Vertices in 3D Space (mathematical coordinates):");
      Object.entries(vertices3DInternal).forEach(([label, coords]) => {
        const mathCoords = toMathCoords(coords[0], coords[1], coords[2]);
        console.log(
          `     ${label}: [${mathCoords[0].toFixed(2)}, ${mathCoords[1].toFixed(
            2
          )}, ${mathCoords[2].toFixed(2)}]`
        );
      });

      console.log("\n   Plane of Betspot:");
      console.log("     - Lies in the XY plane (z = 0)");
      const normalMath = toMathCoords(0, 0, 1);
      console.log(
        `     - Normal vector: [${normalMath[0]}, ${normalMath[1]}, ${normalMath[2]}] (pointing along +Z axis, out of screen)`
      );
      console.log("     - The betspot is a flat rectangle in the XY plane");
    } else {
      console.log("   Betspot: Not available (no anchor element)");
    }

    // 3. Ellipse Parameters
    console.log("\n🔵 ELLIPSE PARAMETERS:");
    console.log(`   Semi-major axis (a): ${a.toFixed(2)}px`);
    console.log(`   Semi-minor axis (b): ${b.toFixed(2)}px`);
    console.log(
      `   Theta start: ${((thetaStart * 180) / Math.PI).toFixed(
        2
      )}° (${thetaStart.toFixed(4)} rad)`
    );
    console.log(
      `   Theta end: ${((thetaEnd * 180) / Math.PI).toFixed(
        2
      )}° (${thetaEnd.toFixed(4)} rad)`
    );
    console.log(
      `   Arc span: ${(((thetaEnd - thetaStart) * 180) / Math.PI).toFixed(2)}°`
    );

    // 4. Ellipse in 3D Space
    const baseRot = rotAngle + rotExtra;
    const c = Math.cos(baseRot);
    const s = Math.sin(baseRot);

    // Major axis vector (in local XY plane before tilt)
    const majorAxisLocal = [c, s, 0];
    const majorAxisLength = Math.hypot(
      majorAxisLocal[0],
      majorAxisLocal[1],
      majorAxisLocal[2]
    );
    const majorAxisNormalized =
      majorAxisLength > 0.0001
        ? [
            majorAxisLocal[0] / majorAxisLength,
            majorAxisLocal[1] / majorAxisLength,
            majorAxisLocal[2] / majorAxisLength,
          ]
        : [1, 0, 0];

    // Minor axis vector (perpendicular to major axis in XY plane, before tilt)
    const minorAxisLocal = [-s, c, 0];
    const minorAxisLength = Math.hypot(
      minorAxisLocal[0],
      minorAxisLocal[1],
      minorAxisLocal[2]
    );
    const minorAxisNormalized =
      minorAxisLength > 0.0001
        ? [
            minorAxisLocal[0] / minorAxisLength,
            minorAxisLocal[1] / minorAxisLength,
            minorAxisLocal[2] / minorAxisLength,
          ]
        : [0, 1, 0];

    const majorAxisMath = toMathCoords(
      majorAxisNormalized[0],
      majorAxisNormalized[1],
      majorAxisNormalized[2]
    );
    const minorAxisMath = toMathCoords(
      minorAxisNormalized[0],
      minorAxisNormalized[1],
      minorAxisNormalized[2]
    );

    console.log("\n   Major Axis (before tilt):");
    console.log(
      `     Direction vector: [${majorAxisMath[0].toFixed(
        4
      )}, ${majorAxisMath[1].toFixed(4)}, ${majorAxisMath[2].toFixed(4)}]`
    );
    console.log(`     Length: ${a.toFixed(2)}px`);
    console.log(`     Angle: ${((baseRot * 180) / Math.PI).toFixed(2)}°`);

    console.log("\n   Minor Axis (before tilt):");
    console.log(
      `     Direction vector: [${minorAxisMath[0].toFixed(
        4
      )}, ${minorAxisMath[1].toFixed(4)}, ${minorAxisMath[2].toFixed(4)}]`
    );
    console.log(`     Length: ${b.toFixed(2)}px`);
    console.log(
      `     Angle: ${(((baseRot + Math.PI / 2) * 180) / Math.PI).toFixed(2)}°`
    );

    // 5. Ellipse Plane Tilt
    const ellipseTiltRad = ((90 - ellipseTiltDeg) * Math.PI) / 180;
    console.log("\n   Ellipse Tilt:");
    console.log(`     Tilt angle: ${ellipseTiltDeg.toFixed(2)}°`);
    console.log(
      `     Rotation angle: ${((ellipseTiltRad * 180) / Math.PI).toFixed(
        2
      )}° around major axis`
    );

    // Calculate ellipse plane normal after tilt
    // The ellipse plane normal is perpendicular to both major and minor axes
    // After tilting, we need to rotate the minor axis around the major axis
    if (majorAxisLength > 0.0001) {
      const ct = Math.cos(ellipseTiltRad);
      const st = Math.sin(ellipseTiltRad);
      const oneMinusCt = 1 - ct;
      const normalizedAxis = majorAxisNormalized;

      // Rotate minor axis around major axis
      const minorAxisAfterTilt = [
        (ct + normalizedAxis[0] * normalizedAxis[0] * oneMinusCt) *
          minorAxisLocal[0] +
          (normalizedAxis[0] * normalizedAxis[1] * oneMinusCt -
            normalizedAxis[2] * st) *
            minorAxisLocal[1] +
          (normalizedAxis[0] * normalizedAxis[2] * oneMinusCt +
            normalizedAxis[1] * st) *
            minorAxisLocal[2],
        (normalizedAxis[1] * normalizedAxis[0] * oneMinusCt +
          normalizedAxis[2] * st) *
          minorAxisLocal[0] +
          (ct + normalizedAxis[1] * normalizedAxis[1] * oneMinusCt) *
            minorAxisLocal[1] +
          (normalizedAxis[1] * normalizedAxis[2] * oneMinusCt -
            normalizedAxis[0] * st) *
            minorAxisLocal[2],
        (normalizedAxis[2] * normalizedAxis[0] * oneMinusCt -
          normalizedAxis[1] * st) *
          minorAxisLocal[0] +
          (normalizedAxis[2] * normalizedAxis[1] * oneMinusCt +
            normalizedAxis[0] * st) *
            minorAxisLocal[1] +
          (ct + normalizedAxis[2] * normalizedAxis[2] * oneMinusCt) *
            minorAxisLocal[2],
      ];

      // Calculate plane normal (cross product of major and minor axes)
      const planeNormal = [
        majorAxisNormalized[1] * minorAxisAfterTilt[2] -
          majorAxisNormalized[2] * minorAxisAfterTilt[1],
        majorAxisNormalized[2] * minorAxisAfterTilt[0] -
          majorAxisNormalized[0] * minorAxisAfterTilt[2],
        majorAxisNormalized[0] * minorAxisAfterTilt[1] -
          majorAxisNormalized[1] * minorAxisAfterTilt[0],
      ];
      const normalLength = Math.hypot(
        planeNormal[0],
        planeNormal[1],
        planeNormal[2]
      );
      const planeNormalNormalized =
        normalLength > 0.0001
          ? [
              planeNormal[0] / normalLength,
              planeNormal[1] / normalLength,
              planeNormal[2] / normalLength,
            ]
          : [0, 0, 1];

      const planeNormalMath = toMathCoords(
        planeNormalNormalized[0],
        planeNormalNormalized[1],
        planeNormalNormalized[2]
      );
      const majorAxisAfterTiltMath = toMathCoords(
        majorAxisNormalized[0],
        majorAxisNormalized[1],
        majorAxisNormalized[2]
      );
      const minorAxisAfterTiltMath = toMathCoords(
        minorAxisAfterTilt[0],
        minorAxisAfterTilt[1],
        minorAxisAfterTilt[2]
      );

      console.log("\n   Ellipse Plane (after tilt):");
      console.log(
        `     Normal vector: [${planeNormalMath[0].toFixed(
          4
        )}, ${planeNormalMath[1].toFixed(4)}, ${planeNormalMath[2].toFixed(4)}]`
      );
      console.log(
        `     Major axis (after tilt): [${majorAxisAfterTiltMath[0].toFixed(
          4
        )}, ${majorAxisAfterTiltMath[1].toFixed(
          4
        )}, ${majorAxisAfterTiltMath[2].toFixed(4)}]`
      );
      console.log(
        `     Minor axis (after tilt): [${minorAxisAfterTiltMath[0].toFixed(
          4
        )}, ${minorAxisAfterTiltMath[1].toFixed(
          4
        )}, ${minorAxisAfterTiltMath[2].toFixed(4)}]`
      );
    }

    // 6. Sample Ellipse Path Points in 3D
    console.log("\n📊 ELLIPSE PATH POINTS IN 3D (sample points):");
    const NUM_SAMPLES = 8;
    const pathPoints3D = [];
    for (let i = 0; i <= NUM_SAMPLES; i++) {
      const t = i / NUM_SAMPLES;
      const th = thetaStart + (thetaEnd - thetaStart) * t;

      // Ellipse point in local coordinate system
      const lx = a * Math.cos(th);
      const ly = b * Math.sin(th);

      // Apply rotation
      const rx = c * lx - s * ly;
      const ry = s * lx + c * ly;
      const rz = depthAmp * Math.sin(th + depthPhase);
      let p = [rx, ry, rz];

      // Apply ellipse tilt
      const ellipseTiltRad = ((90 - ellipseTiltDeg) * Math.PI) / 180;
      const majorAxis = [c, s, 0];
      const axisLen = Math.hypot(majorAxis[0], majorAxis[1], majorAxis[2]);
      if (axisLen > 0.0001) {
        const normalizedAxis = [
          majorAxis[0] / axisLen,
          majorAxis[1] / axisLen,
          majorAxis[2] / axisLen,
        ];
        const ct = Math.cos(ellipseTiltRad);
        const st = Math.sin(ellipseTiltRad);
        const oneMinusCt = 1 - ct;

        const m00 = ct + normalizedAxis[0] * normalizedAxis[0] * oneMinusCt;
        const m01 =
          normalizedAxis[0] * normalizedAxis[1] * oneMinusCt -
          normalizedAxis[2] * st;
        const m02 =
          normalizedAxis[0] * normalizedAxis[2] * oneMinusCt +
          normalizedAxis[1] * st;
        const m10 =
          normalizedAxis[1] * normalizedAxis[0] * oneMinusCt +
          normalizedAxis[2] * st;
        const m11 = ct + normalizedAxis[1] * normalizedAxis[1] * oneMinusCt;
        const m12 =
          normalizedAxis[1] * normalizedAxis[2] * oneMinusCt -
          normalizedAxis[0] * st;
        const m20 =
          normalizedAxis[2] * normalizedAxis[0] * oneMinusCt -
          normalizedAxis[1] * st;
        const m21 =
          normalizedAxis[2] * normalizedAxis[1] * oneMinusCt +
          normalizedAxis[0] * st;
        const m22 = ct + normalizedAxis[2] * normalizedAxis[2] * oneMinusCt;

        p = [
          m00 * p[0] + m01 * p[1] + m02 * p[2],
          m10 * p[0] + m11 * p[1] + m12 * p[2],
          m20 * p[0] + m21 * p[1] + m22 * p[2],
        ];
      }

      // Convert to mathematical coordinates for display
      const pointMath = toMathCoords(p[0], p[1], p[2]);
      pathPoints3D.push({
        theta: th,
        thetaDeg: ((th * 180) / Math.PI).toFixed(2),
        point3D: pointMath,
      });
    }

    pathPoints3D.forEach((pt, idx) => {
      console.log(
        `   Point ${idx} (θ=${pt.thetaDeg}°): [${pt.point3D[0].toFixed(
          2
        )}, ${pt.point3D[1].toFixed(2)}, ${pt.point3D[2].toFixed(2)}]`
      );
    });

    // 7. Transformations
    console.log("\n🔄 TRANSFORMATIONS:");
    console.log(
      `   Base rotation angle: ${((rotAngle * 180) / Math.PI).toFixed(2)}°`
    );
    console.log(
      `   Extra rotation: ${((rotExtra * 180) / Math.PI).toFixed(2)}°`
    );
    console.log(
      `   Total rotation: ${((baseRot * 180) / Math.PI).toFixed(2)}°`
    );
    console.log(`   Depth amplitude: ${depthAmp.toFixed(2)}`);
    console.log(
      `   Depth phase: ${((depthPhase * 180) / Math.PI).toFixed(2)}°`
    );
    console.log(`   Camera distance: ${camDist.toFixed(2)}px`);
    console.log(`   Camera tilt X: ${((tiltX * 180) / Math.PI).toFixed(2)}°`);
    console.log(`   Camera tilt Y: ${((tiltY * 180) / Math.PI).toFixed(2)}°`);

    console.log("\n" + "=".repeat(80) + "\n");
  };

  const computePathLength = (
    a,
    b,
    rotAngle,
    rotExtra,
    thetaStart,
    thetaEnd,
    centerX,
    centerY,
    camDist,
    tiltX,
    tiltY,
    depthAmp,
    depthPhase,
    ellipseTiltDeg
  ) => {
    const SAMPLES = 128;
    const baseRot = rotAngle + rotExtra;
    const c = Math.cos(baseRot);
    const s = Math.sin(baseRot);
    const cx = Math.cos(tiltX),
      sx = Math.sin(tiltX);
    const cy = Math.cos(tiltY),
      sy = Math.sin(tiltY);

    const project = (lx, ly, th) => {
      const rx = c * lx - s * ly;
      const ry = s * lx + c * ly;
      const rz = depthAmp * Math.sin(th + depthPhase);
      let p = [rx, ry, rz];

      // Apply ellipse plane tilt: rotate around the major axis to tilt the ellipse plane
      // At 0°: minor axis is on z-axis (ellipse plane is vertical, rotate 90° around major axis)
      // At 90°: minor axis is in XY plane (ellipse plane is horizontal, no rotation)
      // So we rotate by (90° - ellipseTiltDeg) around the major axis to tilt the ellipse plane
      const ellipseTiltRad = ((90 - ellipseTiltDeg) * Math.PI) / 180;

      // Major axis direction (in XY plane, this is the rotation axis)
      // Major axis is (cos(baseRot), sin(baseRot), 0)
      const majorAxis = [c, s, 0];
      const axisLen = Math.hypot(majorAxis[0], majorAxis[1], majorAxis[2]);
      if (axisLen > 0.0001) {
        const normalizedAxis = [
          majorAxis[0] / axisLen,
          majorAxis[1] / axisLen,
          majorAxis[2] / axisLen,
        ];

        // Rotation around major axis using Rodrigues' rotation formula
        const ct = Math.cos(ellipseTiltRad);
        const st = Math.sin(ellipseTiltRad);
        const oneMinusCt = 1 - ct;

        // Rotation matrix components
        const m00 = ct + normalizedAxis[0] * normalizedAxis[0] * oneMinusCt;
        const m01 =
          normalizedAxis[0] * normalizedAxis[1] * oneMinusCt -
          normalizedAxis[2] * st;
        const m02 =
          normalizedAxis[0] * normalizedAxis[2] * oneMinusCt +
          normalizedAxis[1] * st;
        const m10 =
          normalizedAxis[1] * normalizedAxis[0] * oneMinusCt +
          normalizedAxis[2] * st;
        const m11 = ct + normalizedAxis[1] * normalizedAxis[1] * oneMinusCt;
        const m12 =
          normalizedAxis[1] * normalizedAxis[2] * oneMinusCt -
          normalizedAxis[0] * st;
        const m20 =
          normalizedAxis[2] * normalizedAxis[0] * oneMinusCt -
          normalizedAxis[1] * st;
        const m21 =
          normalizedAxis[2] * normalizedAxis[1] * oneMinusCt +
          normalizedAxis[0] * st;
        const m22 = ct + normalizedAxis[2] * normalizedAxis[2] * oneMinusCt;

        // Apply rotation
        p = [
          m00 * p[0] + m01 * p[1] + m02 * p[2],
          m10 * p[0] + m11 * p[1] + m12 * p[2],
          m20 * p[0] + m21 * p[1] + m22 * p[2],
        ];

        // Add perpendicular offset to create visible diversion from diagonal
        // The offset is perpendicular to the major axis in the XY plane
        // Magnitude is based on tilt angle to push ellipse away from diagonal
        // Use the tilt angle directly (0° = no offset, 90° = max offset)
        const tiltOffsetAmount = (ellipseTiltDeg / 90.0) * b * 0.3; // Scale with minor axis and tilt
        // Perpendicular to major axis: rotate major axis by 90° in XY plane
        const perpendicularDir = [-normalizedAxis[1], normalizedAxis[0]]; // Perpendicular in XY plane
        p[0] += perpendicularDir[0] * tiltOffsetAmount;
        p[1] += perpendicularDir[1] * tiltOffsetAmount;
      }

      // Apply camera tilt: rotate around X then around Y
      const tx = p[0];
      const ty = cx * p[1] - sx * p[2];
      const tz = sx * p[1] + cx * p[2];
      const ux = cy * tx + sy * tz;
      const uy = ty;
      const uz = -sy * tx + cy * tz;
      const px = (centerX + ux) / (1 + uz / camDist);
      const py = (centerY + uy) / (1 + uz / camDist);
      return [px, py];
    };

    let [px0, py0] = project(
      a * Math.cos(thetaStart),
      b * Math.sin(thetaStart),
      thetaStart
    );
    let total = 0;
    for (let i = 1; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const th = thetaStart + (thetaEnd - thetaStart) * t;
      const [px, py] = project(a * Math.cos(th), b * Math.sin(th), th);
      total += Math.hypot(px - px0, py - py0);
      px0 = px;
      py0 = py;
    }
    return total;
  };

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
    glRef.current = gl;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const positionBuffer = gl.createBuffer();
    positionBufferRef.current = positionBuffer;
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

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const animate = (ts) => {
      if (!isPlaying) {
        animationIdRef[0] = null;
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }

      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dtSec = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      accumulatedSecRef.current += dtSec;

      const currentTimeSec = accumulatedSecRef.current;

      let centerX = canvas.width / 2;
      let centerY = canvas.height / 2;
      let rect = null;
      if (anchorEl?.getBoundingClientRect) {
        rect = anchorEl.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
      }

      const cfg = { ...DEFAULT_CONFIG, ...config };
      const activePaths = (cfg.paths || []).filter((p) => p.enabled !== false);

      for (const p of activePaths) {
        // Check if this is a circle path
        const isCirclePath =
          p.type === "circle" || p.circleRadius !== undefined;

        if (isCirclePath) {
          // Handle circle path
          // For circle paths: a = diagonal/2, b = circleRadius
          // Ellipse is rotated 135° (3π/4) - major axis at 135° from positive x-axis
          const ellipseCfg = p.ellipse || cfg.ellipse;
          const rotAngle = (135 * Math.PI) / 180; // 3π/4 radians

          const circleRadius = p.circleRadius ?? 30;

          // a should be calculated from betspot diagonal: a = diagonalLength / 2
          // Ignore config ellipse.a value, always calculate from actual rect size
          let autoA;
          if (rect) {
            const diagonal = Math.hypot(rect.width, rect.height);
            autoA = diagonal / 2; // For 200x200 betspot: diagonal = 200√2, so a = 100√2 ≈ 141.4214
          } else {
            // Fallback: assume 200px betspot -> 100√2 ≈ 141.4214
            autoA = 141.4214;
          }

          // b should equal circleRadius (minor axis)
          const bVal = circleRadius;

          // Get start vertex from path config (default to BR)
          const startVertex = p.startVertex || "BR";

          // Calculate rotation angle based on start vertex:
          // BR or TL: 135° (3π/4) - major axis along y = -x (BR↔TL diagonal)
          // BL or TR: 45° (π/4) - major axis along y = x (BL↔TR diagonal)
          const dynamicRotAngle =
            startVertex === "BR" || startVertex === "TL"
              ? (135 * Math.PI) / 180 // 3π/4
              : (45 * Math.PI) / 180; // π/4

          const prev = pathMetricsRef.current.get(p.id);
          if (
            !prev ||
            prev.centerX !== centerX ||
            prev.centerY !== centerY ||
            prev.a !== autoA ||
            prev.b !== bVal ||
            prev.rotAngle !== dynamicRotAngle ||
            prev.circleRadius !== circleRadius ||
            prev.startVertex !== startVertex ||
            prev.isCircle !== true
          ) {
            // Debug logging disabled for performance
            // Uncomment for debugging:
            // if (p.id === 3) {
            //   console.log(`[GlowAnimation] Calling computeCirclePathLength with a=${autoA.toFixed(4)}, b=${bVal}, circleRadius=${circleRadius}`);
            // }
            const pathResult = computeCirclePathLength(
              autoA,
              bVal,
              dynamicRotAngle,
              centerX,
              centerY,
              circleRadius,
              rect,
              startVertex
            );
            pathMetricsRef.current.set(p.id, {
              pathLength: pathResult.pathLength,
              startTheta: pathResult.startTheta,
              meetingTheta: pathResult.meetingTheta,
              rotAngle: dynamicRotAngle, // Use the dynamic rotation angle based on start vertex
              centerX,
              centerY,
              a: autoA,
              b: bVal,
              circleRadius,
              startVertex,
              isCircle: true,
            });
          }
        } else {
          // Handle regular ellipse path
          const ellipseCfg = p.ellipse || cfg.ellipse;
          const startDir = getAngleForVertex(p.startVertex);
          const endDir = getAngleForVertex(p.endVertex);
          let delta =
            ((((endDir - startDir + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) %
              (2 * Math.PI)) -
            Math.PI;
          let dir = Math.sign(delta) || 1;
          const thetaStartLocal = 0.0;
          const thetaEndLocal = Math.abs(delta || Math.PI);
          const rotAngle = startDir;

          const cam = p.cameraDistance ?? cfg.cameraDistance ?? CAMERA_DISTANCE;
          const tiltX = degToRad(p.viewTiltXDeg ?? cfg.viewTiltXDeg ?? 0);
          const tiltY = degToRad(p.viewTiltYDeg ?? cfg.viewTiltYDeg ?? 0);
          const depthAmp = p.depthAmplitude ?? cfg.depthAmplitude ?? 0;
          const depthPhase = degToRad(
            p.depthPhaseDeg ?? cfg.depthPhaseDeg ?? 0
          );
          const rotExtra = degToRad(p.ellipseRotationDeg ?? 0);
          const ellipseTiltDeg = p.ellipseTiltDeg ?? cfg.ellipseTiltDeg ?? 0;

          let autoA = ellipseCfg?.a;
          let bVal = ellipseCfg?.b ?? 0.0;
          if (rect && autoA === undefined) {
            // Default: a = 10px + (diagonal / 2)
            const diagonal = Math.hypot(rect.width, rect.height);
            autoA = diagonal / 2;
          } else if (autoA === undefined) {
            autoA = 150; // fallback if no rect and no config
          }

          const prev = pathMetricsRef.current.get(p.id);
          if (
            !prev ||
            prev.centerX !== centerX ||
            prev.centerY !== centerY ||
            prev.a !== autoA ||
            prev.b !== bVal ||
            prev.thetaEndLocal !== thetaEndLocal ||
            prev.rotAngle !== rotAngle ||
            prev.dir !== dir ||
            prev.cam !== cam ||
            prev.tiltX !== tiltX ||
            prev.tiltY !== tiltY ||
            prev.depthAmp !== depthAmp ||
            prev.depthPhase !== depthPhase ||
            prev.rotExtra !== rotExtra ||
            prev.ellipseTiltDeg !== ellipseTiltDeg ||
            prev.isCircle === true
          ) {
            const pathLength = computePathLength(
              autoA,
              bVal,
              rotAngle,
              rotExtra,
              thetaStartLocal,
              thetaEndLocal,
              centerX,
              centerY,
              cam,
              tiltX,
              tiltY,
              depthAmp,
              depthPhase,
              ellipseTiltDeg
            );
            pathMetricsRef.current.set(p.id, {
              pathLength,
              thetaEndLocal,
              rotAngle,
              dir,
              centerX,
              centerY,
              a: autoA,
              b: bVal,
              cam,
              tiltX,
              tiltY,
              depthAmp,
              depthPhase,
              rotExtra,
              ellipseTiltDeg,
              isCircle: false,
            });

            // Log 3D coordinates when path configuration changes
            if (!loggedPathsRef.current.has(p.id)) {
              log3DCoordinates(
                p.id,
                autoA,
                bVal,
                rotAngle,
                rotExtra,
                thetaStartLocal,
                thetaEndLocal,
                centerX,
                centerY,
                cam,
                tiltX,
                tiltY,
                depthAmp,
                depthPhase,
                ellipseTiltDeg,
                rect
              );
              loggedPathsRef.current.add(p.id);
            }
          }
        }
      }

      let allComplete = activePaths.length > 0;
      const animationTimeMsGlobal =
        cfg.animationTimeMs ?? DEFAULT_CONFIG.animationTimeMs;

      for (const p of activePaths) {
        const delayRaw = p.delay || 0;
        const delaySec = delayToSeconds(delayRaw);
        const durationSec =
          (p.animationTimeMs ?? animationTimeMsGlobal) / 1000.0;
        const elapsed = Math.max(0, currentTimeSec - delaySec);

        const metrics = pathMetricsRef.current.get(p.id);
        const lineLength = p.length ?? cfg.length ?? 300.0;
        const pathLength = metrics?.pathLength || 1.0;
        const segmentParam = lineLength / Math.max(pathLength, 0.0001);
        const overshoot = p.overshoot ?? cfg.overshoot ?? 0.08;
        const fadeWindow = p.fadeWindow ?? cfg.fadeWindow ?? 0.08;
        const totalSpan = 1.0 + segmentParam + overshoot;

        // Calculate eased normalized time (same as in shader)
        const normalizedTime = Math.min(
          1.0,
          Math.max(0.0, elapsed / Math.max(durationSec, 0.0001))
        );
        // Use spark easing for regular ellipse paths
        let easedNormalizedTime = applyEasingSpark(normalizedTime);

        // Ensure eased time reaches 1.0 when normalized time is 1.0 (for completion)
        // This prevents lingering dots when easing functions approach 1.0 asymptotically
        if (normalizedTime >= 1.0) {
          easedNormalizedTime = 1.0;
        }

        // Scale phase using eased time (same calculation as in shader)
        const scaledPhase = easedNormalizedTime * totalSpan;
        const completeThreshold = totalSpan + fadeWindow;

        // Check completion: animation is complete when phase reaches threshold
        // The fade window is in phase units, so we need to convert it to time
        // Since phase = easedNormalizedTime * totalSpan, and easedNormalizedTime goes from 0 to 1
        // The fade window phase units correspond to: fadeWindow / totalSpan of the normalized time
        // So the fade window duration is: (fadeWindow / totalSpan) * durationSec
        const fadeWindowDuration = (fadeWindow / totalSpan) * durationSec;
        const totalDuration = durationSec + fadeWindowDuration;

        // Path is complete if:
        // 1. Enough time has elapsed (including fade window), OR
        // 2. Phase has reached the complete threshold
        const isPathComplete =
          elapsed >= totalDuration || scaledPhase >= completeThreshold - 0.0001;

        if (!isPathComplete) {
          allComplete = false;
        }
      }

      if (allComplete && activePaths.length > 0) {
        animationIdRef[0] = null;
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (onAnimationComplete) onAnimationComplete();
        return;
      }

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);

      for (const path of activePaths) {
        // Check if this is a circle path
        const isCirclePath =
          path.type === "circle" || path.circleRadius !== undefined;

        // Calculate eased normalized time for this path
        const delayRaw = path.delay || 0;
        const delaySec = delayToSeconds(delayRaw);
        const durationSec =
          (path.animationTimeMs ?? animationTimeMsGlobal) / 1000.0;
        const elapsed = Math.max(0, currentTimeSec - delaySec);
        const normalizedTime = Math.min(
          1.0,
          Math.max(0.0, elapsed / Math.max(durationSec, 0.0001))
        );
        // Use different easing for circle vs spark animations
        let easedNormalizedTime = isCirclePath
          ? applyEasingCircle(normalizedTime)
          : applyEasingSpark(normalizedTime);

        // Ensure eased time reaches 1.0 when normalized time is 1.0 (for completion)
        if (normalizedTime >= 1.0) {
          easedNormalizedTime = 1.0;
        }

        const metrics = pathMetricsRef.current.get(path.id);
        const pathLength = metrics?.pathLength || 1.0;

        if (isCirclePath) {
          // Draw circle path
          // For circle paths: a = diagonal/2, b = circleRadius
          const ellipseCfg = path.ellipse || cfg.ellipse;
          const circleRadius = path.circleRadius ?? 30;

          // a should be calculated from betspot diagonal: a = diagonalLength / 2
          // Ignore config ellipse.a value, always calculate from actual rect size
          let autoA;
          if (rect) {
            const diagonal = Math.hypot(rect.width, rect.height);
            autoA = diagonal / 2; // For 200x200 betspot: diagonal = 200√2, so a = 100√2 ≈ 141.4214
          } else {
            // Fallback: assume 200px betspot -> 100√2 ≈ 141.4214
            autoA = 141.4214;
          }

          // b should equal circleRadius (minor axis)
          const bVal = circleRadius;

          const pathWithAutoEllipse = {
            ...path,
            ellipse: { ...(path.ellipse || {}), a: autoA, b: bVal },
          };

          const metrics = pathMetricsRef.current.get(path.id);
          drawSparkCircle({
            gl,
            canvas,
            anchorCenter: [centerX, centerY],
            timeNowSec: currentTimeSec,
            globalConfig: cfg,
            pathConfig: pathWithAutoEllipse,
            easedNormalizedTime,
            totalArcPx: metrics?.pathLength || pathLength,
            startTheta: metrics?.startTheta ?? 0,
            meetingTheta: metrics?.meetingTheta ?? 0,
            rotAngle: metrics?.rotAngle, // Pass the dynamic rotation angle from metrics
          });
        } else {
          // Draw regular ellipse path
          const ellipseCfg = path.ellipse || cfg.ellipse;
          let autoA = ellipseCfg?.a;
          let bVal = ellipseCfg?.b ?? 0.0;
          if (rect && autoA === undefined) {
            // Default: a = 10px + (diagonal / 2)
            const diagonal = Math.hypot(rect.width, rect.height);
            autoA = 10 + diagonal / 2;
          } else if (autoA === undefined) {
            autoA = 150; // fallback if no rect and no config
          }
          const pathWithAutoEllipse = {
            ...path,
            ellipse: { ...(path.ellipse || {}), a: autoA, b: bVal },
          };

          drawSpark({
            gl,
            canvas,
            anchorCenter: [centerX, centerY],
            timeNowSec: currentTimeSec,
            globalConfig: cfg,
            pathConfig: pathWithAutoEllipse,
            easedNormalizedTime,
            totalArcPx: pathLength,
          });
        }
      }

      animationIdRef[0] = requestAnimationFrame(animate);
    };

    if (isPlaying && !animationIdRef[0]) {
      lastTsRef.current = null;
      accumulatedSecRef.current = 0;
      loggedPathsRef.current.clear(); // Reset logged paths when animation restarts
      animationIdRef[0] = requestAnimationFrame(animate);
    } else if (!isPlaying && animationIdRef[0]) {
      cancelAnimationFrame(animationIdRef[0]);
      animationIdRef[0] = null;
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    return () => {
      if (animationIdRef[0]) {
        cancelAnimationFrame(animationIdRef[0]);
        animationIdRef[0] = null;
      }
      window.removeEventListener("resize", resizeCanvas);
      if (positionBufferRef.current) {
        gl.deleteBuffer(positionBufferRef.current);
        positionBufferRef.current = null;
      }
      if (glRef.current) {
        try {
          disposeSpark(glRef.current);
          disposeSparkCircle(glRef.current);
        } catch {}
      }
    };
  }, [anchorEl, config, isPlaying, onAnimationComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
