import { FRAGMENT_SHADER_CIRCLE, VERTEX_SHADER_CIRCLE } from "./shadersCircle";
import { resolveNumber } from "./utils";

// Cache a single compiled program per WebGL context
const programCache = new WeakMap();

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    console.error("[ShaderCompilationError]", info);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation error: ${info}`);
  }
  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    console.error("[ProgramLinkError]", info);
    gl.deleteProgram(program);
    throw new Error(`Program linking error: ${info}`);
  }
  return program;
}

function getProgramBundle(gl) {
  let bundle = programCache.get(gl);
  if (bundle) return bundle;
  const v = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_CIRCLE);
  const f = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_CIRCLE);
  const program = createProgram(gl, v, f);
  const attribs = {
    positionLocation: gl.getAttribLocation(program, "a_position"),
  };
  const uniforms = {
    resolutionLocation: gl.getUniformLocation(program, "u_resolution"),
    centerLocation: gl.getUniformLocation(program, "u_center"),
    timeLocation: gl.getUniformLocation(program, "u_time"),
    delayLocation: gl.getUniformLocation(program, "u_delay"),
    animationTimeLocation: gl.getUniformLocation(program, "u_animationTime"),
    headRadiusLocation: gl.getUniformLocation(program, "u_headRadius"),
    tailRadiusLocation: gl.getUniformLocation(program, "u_tailRadius"),
    glowRadiusLocation: gl.getUniformLocation(program, "u_glowRadius"),
    lineLengthLocation: gl.getUniformLocation(program, "u_lineLength"),
    totalArcPxLocation: gl.getUniformLocation(program, "u_totalArcPx"),
    aLocation: gl.getUniformLocation(program, "u_a"),
    bLocation: gl.getUniformLocation(program, "u_b"),
    rotAngleLocation: gl.getUniformLocation(program, "u_rotAngle"),
    circleRadiusLocation: gl.getUniformLocation(program, "u_circleRadius"),
    startThetaLocation: gl.getUniformLocation(program, "u_startTheta"),
    meetingThetaLocation: gl.getUniformLocation(program, "u_meetingTheta"),
    overshootLocation: gl.getUniformLocation(program, "u_overshoot"),
    fadeWindowLocation: gl.getUniformLocation(program, "u_fadeWindow"),
    easedNormalizedTimeLocation: gl.getUniformLocation(
      program,
      "u_easedNormalizedTime"
    ),
    sparkColorLocation: gl.getUniformLocation(program, "u_sparkColor"),
    glowColorLocation: gl.getUniformLocation(program, "u_glowColor"),
  };
  bundle = { program, attribs, uniforms };
  programCache.set(gl, bundle);
  return bundle;
}

function delayToSeconds(v) {
  if (typeof v !== "number" || isNaN(v)) return 0;
  return v > 20 ? v / 1000 : v; // treat large values as ms
}

// Convert hex color to RGB array [r, g, b] in 0-1 range
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    // Default to white if invalid
    return [1.0, 1.0, 1.0];
  }
  return [
    parseInt(result[1], 16) / 255.0,
    parseInt(result[2], 16) / 255.0,
    parseInt(result[3], 16) / 255.0,
  ];
}

// Cache for hex color conversions to avoid regex on every frame
const colorCache = new Map();

// Helper function to get vertex coordinates in mathematical coordinates (Y+ up)
// Returns [x, y] relative to center
function getVertexCoords(vertexId, rect) {
  if (!rect) {
    // Fallback: assume 200px betspot
    const fallback = {
      TL: [-100, 100], // Top-Left: negative X, positive Y (math coords)
      TR: [100, 100], // Top-Right: positive X, positive Y
      BR: [100, -100], // Bottom-Right: positive X, negative Y
      BL: [-100, -100], // Bottom-Left: negative X, negative Y
    };
    return fallback[vertexId] || [100, -100]; // Default to BR
  }

  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  // In mathematical coordinates (Y+ up):
  // TL: (-halfWidth, halfHeight)
  // TR: (halfWidth, halfHeight)
  // BR: (halfWidth, -halfHeight)
  // BL: (-halfWidth, -halfHeight)
  const coords = {
    TL: [-halfWidth, halfHeight],
    TR: [halfWidth, halfHeight],
    BR: [halfWidth, -halfHeight],
    BL: [-halfWidth, -halfHeight],
  };

  return coords[vertexId] || [halfWidth, -halfHeight]; // Default to BR
}

// Compute path length for ellipse + circle path
export function computeCirclePathLength(
  a,
  b,
  rotAngle,
  centerX,
  centerY,
  circleRadius,
  rect = null,
  startVertex = "BR" // Default to Bottom-Right
) {
  // Performance: Only log in development mode
  const DEBUG = startVertex === "BL"; // Enable debug for BL to diagnose the issue
  if (DEBUG) {
    console.log(
      `[computeCirclePathLength] Received: a=${a.toFixed(4)}, b=${b.toFixed(
        4
      )}, circleRadius=${circleRadius}, rect=${
        rect ? `${rect.width}x${rect.height}` : "null"
      }`
    );
  }

  const SAMPLES = 128; // Reduced from 256 for better performance, still accurate

  // Ellipse parameters:
  // - Semi-major axis a = diagonalLength / 2 (calculated from betspot size)
  //   For 200x200 betspot: diagonal = 200√2, so a = 100√2 ≈ 141.4214
  // - Semi-minor axis b = circleRadius (equals circle radius)
  // - Rotation angle: depends on start vertex
  //   * BR or TL: 135° (3π/4) - major axis along y = -x (BR↔TL diagonal)
  //   * BL or TR: 45° (π/4) - major axis along y = x (BL↔TR diagonal)
  const rotAngleRad =
    startVertex === "BR" || startVertex === "TL"
      ? (135 * Math.PI) / 180 // 3π/4 - major axis along y = -x
      : (45 * Math.PI) / 180; // π/4 - major axis along y = x
  const c = Math.cos(rotAngleRad);
  const s = Math.sin(rotAngleRad);

  // Helper function to get ellipse position for a given theta
  // Returns position in mathematical coordinates (Y+ up) relative to center
  // This matches the coordinate system used by Spark animation
  const getEllipsePosMath = (theta) => {
    const x_local = a * Math.cos(theta);
    const y_local = b * Math.sin(theta);
    // Apply rotation in math coords (Y+ up)
    const x_math = c * x_local - s * y_local;
    const y_math = s * x_local + c * y_local;
    return [x_math, y_math];
  };

  // Helper function to get ellipse position in screen coordinates (for rendering)
  // Converts from math coords (Y+ up) to screen coords (Y+ down)
  const getEllipsePos = (theta) => {
    const [x_math, y_math] = getEllipsePosMath(theta);
    // Convert to screen coords: screen Y = -math Y (flip Y axis)
    const x = x_math + centerX;
    const y = -y_math + centerY;
    return [x, y];
  };

  // Helper function to find theta from a point (relative to center)
  // targetX, targetY are in mathematical coordinates (Y+ up)
  // Optimized for performance: reduced iterations and smarter initial guess
  const findThetaFromPoint = (targetX, targetY, initialGuess = 0) => {
    // Try multiple initial guesses for better convergence
    // Add more guesses around the initial guess to improve chances of finding the right theta
    const guesses = [
      initialGuess,
      initialGuess + Math.PI,
      initialGuess + Math.PI / 2,
      initialGuess - Math.PI / 2,
      initialGuess + Math.PI / 4,
      initialGuess - Math.PI / 4,
    ];
    let bestTheta = initialGuess;
    let bestError = Infinity;

    for (const guess of guesses) {
      let theta = guess;
      const tolerance = 0.05; // Tighter tolerance for better accuracy
      const maxIterations = 50; // Increased iterations for better convergence

      // Normalize initial guess
      while (theta < 0) theta += 2 * Math.PI;
      while (theta >= 2 * Math.PI) theta -= 2 * Math.PI;

      for (let iter = 0; iter < maxIterations; iter++) {
        const x_local = a * Math.cos(theta);
        const y_local = b * Math.sin(theta);
        const x = c * x_local - s * y_local;
        const y = s * x_local + c * y_local;

        const dx = x - targetX;
        const dy = y - targetY;
        const error = Math.hypot(dx, dy);

        if (error < tolerance) {
          if (error < bestError) {
            bestError = error;
            bestTheta = theta;
          }
          break;
        }

        // Gradient approximation for Newton's method
        const dtheta = 0.001;
        const [x1, y1] = getEllipsePosMath(theta + dtheta);

        const dx_dtheta = (x1 - x) / dtheta;
        const dy_dtheta = (y1 - y) / dtheta;

        const gradient = dx * dx_dtheta + dy * dy_dtheta;
        const hessian = dx_dtheta * dx_dtheta + dy_dtheta * dy_dtheta;

        if (Math.abs(hessian) > 0.0001) {
          const step = gradient / hessian;
          theta -= step * 0.5; // Dampen the step for stability
        } else {
          // Fallback: try small increments
          theta += error > 10 ? 0.1 : 0.01;
        }

        // Normalize to [0, 2π]
        while (theta < 0) theta += 2 * Math.PI;
        while (theta >= 2 * Math.PI) theta -= 2 * Math.PI;

        // Track best result
        if (error < bestError) {
          bestError = error;
          bestTheta = theta;
        }
      }
    }

    return bestTheta;
  };

  // Calculate start vertex coordinates in math coords
  const [startVertexX, startVertexY] = getVertexCoords(startVertex, rect);

  // Calculate meeting point dynamically based on start vertex
  // The meeting point should be on the circle (radius = circleRadius = b)
  // and should be 90° clockwise from the start vertex to ensure clockwise travel
  const startAngle = Math.atan2(startVertexY, startVertexX);
  // Clockwise rotation: subtract 90° (π/2)
  const meetingAngle = startAngle - Math.PI / 2;
  // Meeting point on circle (radius = circleRadius = b)
  const meetingPointX = circleRadius * Math.cos(meetingAngle);
  const meetingPointY = circleRadius * Math.sin(meetingAngle);

  // Find theta on ellipse that corresponds to this meeting point
  let MEETING_THETA = findThetaFromPoint(
    meetingPointX,
    meetingPointY,
    meetingAngle
  );

  // Verify and refine if needed (compare in math coords)
  const [verifyMeetingX_math, verifyMeetingY_math] =
    getEllipsePosMath(MEETING_THETA);
  let meetingError = Math.hypot(
    verifyMeetingX_math - meetingPointX,
    verifyMeetingY_math - meetingPointY
  );

  // Also get screen coords for display
  let [verifyMeetingX, verifyMeetingY] = getEllipsePos(MEETING_THETA);

  // If error is large, try other theta values (optimized for performance)
  if (meetingError > 1.0) {
    // Search around the meeting angle
    const searchStep = 0.01;
    const searchRange = Math.PI / 2; // Search ±90° around meeting angle
    const searchStart = meetingAngle - searchRange / 2;
    const searchEnd = meetingAngle + searchRange / 2;

    for (
      let testTheta = searchStart;
      testTheta < searchEnd;
      testTheta += searchStep
    ) {
      // Normalize theta
      let normalizedTheta = testTheta;
      while (normalizedTheta < 0) normalizedTheta += 2 * Math.PI;
      while (normalizedTheta >= 2 * Math.PI) normalizedTheta -= 2 * Math.PI;

      const [testX_math, testY_math] = getEllipsePosMath(normalizedTheta);
      const testError = Math.hypot(
        testX_math - meetingPointX,
        testY_math - meetingPointY
      );
      if (testError < meetingError) {
        meetingError = testError;
        MEETING_THETA = normalizedTheta;
        // Update screen coords for display
        const [testX_screen, testY_screen] = getEllipsePos(normalizedTheta);
        verifyMeetingX = testX_screen;
        verifyMeetingY = testY_screen;
        if (meetingError < 0.5) break; // Early exit if good enough
      }
    }
  }

  // Start vertex: Use the provided startVertex (defaults to BR)
  const START_VERTEX_X = startVertexX;
  const START_VERTEX_Y = startVertexY;

  // Find theta that gives us the start vertex
  // For BR, this works well with a simple approach
  // For BL, we need to search specifically in the 3rd quadrant where BL is located
  const startVertexAngle = Math.atan2(START_VERTEX_Y, START_VERTEX_X);
  let initialGuess = startVertexAngle;
  let START_THETA;

  // For BL, search directly in the 3rd quadrant (π to 3π/2) where BL should be
  // This is the same approach that works for BR, just in a different quadrant
  if (startVertex === "BL") {
    // BL is at (-100, -100), which is in the 3rd quadrant
    // Search specifically in theta range [π, 3π/2] with fine steps
    const quadrant3Start = Math.PI;
    const quadrant3End = (3 * Math.PI) / 2;
    const searchStep = 0.001; // Fine step for accurate search
    let bestTheta = quadrant3Start;
    let bestError = Infinity;

    for (
      let theta = quadrant3Start;
      theta <= quadrant3End;
      theta += searchStep
    ) {
      const [testX, testY] = getEllipsePosMath(theta);
      const testError = Math.hypot(
        testX - START_VERTEX_X,
        testY - START_VERTEX_Y
      );
      if (testError < bestError) {
        bestError = testError;
        bestTheta = theta;
      }
    }

    START_THETA = bestTheta;
    if (DEBUG) {
      console.log(
        `  BL: Found theta=${((START_THETA * 180) / Math.PI).toFixed(
          2
        )}° with error=${bestError.toFixed(2)}px`
      );
    }
  } else {
    // For BR and other vertices, use the existing approach that works
    START_THETA = findThetaFromPoint(
      START_VERTEX_X,
      START_VERTEX_Y,
      initialGuess
    );
  }

  // Verify the start point is correct
  // Compare in math coordinates (both start vertex and ellipse position)
  const [verifyStartX_math, verifyStartY_math] = getEllipsePosMath(START_THETA);
  let startError = Math.hypot(
    verifyStartX_math - START_VERTEX_X,
    verifyStartY_math - START_VERTEX_Y
  );

  // For BL, also check distance from center - if too close, the search likely failed
  const distFromCenter = Math.hypot(verifyStartX_math, verifyStartY_math);
  const expectedDistFromCenter = Math.hypot(START_VERTEX_X, START_VERTEX_Y);

  // If we're near center or on circle but target is far from center, this is wrong
  const isOnCircleInitial = Math.abs(distFromCenter - circleRadius) < 5;
  if (
    startVertex === "BL" &&
    (distFromCenter < 50 || isOnCircleInitial) &&
    expectedDistFromCenter > 100
  ) {
    if (DEBUG) {
      console.warn(
        `⚠️ BL initial search found point near center/on circle (${verifyStartX_math.toFixed(
          2
        )}, ${verifyStartY_math.toFixed(
          2
        )}), distance: ${distFromCenter.toFixed(
          2
        )}px, isOnCircle: ${isOnCircleInitial}, but target is far from center (${expectedDistFromCenter.toFixed(
          2
        )}px). Forcing exhaustive re-search.`
      );
    }
    // Force a re-search by setting error high
    startError = 1000; // Force exhaustive search
  }

  // Also get screen coords for display
  let [verifyStartX, verifyStartY] = getEllipsePos(START_THETA);

  // If error is large, search more thoroughly (optimized for performance)
  // For BL, always do thorough search even if error seems small (might be near center)
  // Also check if we're on the circle instead of on the ellipse
  const currentDistFromCenter = Math.hypot(
    verifyStartX_math,
    verifyStartY_math
  );
  const isCurrentOnCircle = Math.abs(currentDistFromCenter - circleRadius) < 5;
  const shouldForceSearch =
    startError > 1.0 ||
    (startVertex === "BL" && (startError > 0.1 || isCurrentOnCircle));

  if (shouldForceSearch) {
    // Determine which quadrant the start vertex is in
    const isPositiveX = START_VERTEX_X > 0;
    const isPositiveY = START_VERTEX_Y > 0;

    let bestTheta = START_THETA;
    let bestError = startError;
    const searchStep = 0.005; // Finer step for better accuracy

    // Search in the appropriate quadrant based on start vertex
    // Also search adjacent quadrants since the rotated ellipse might not align perfectly
    let searchRanges = [];
    if (isPositiveX && !isPositiveY) {
      // 4th quadrant (BR): [3π/2, 2π] and adjacent
      searchRanges = [
        [(3 * Math.PI) / 2, 2 * Math.PI],
        [0, Math.PI / 4], // Adjacent to 4th quadrant
      ];
    } else if (isPositiveX && isPositiveY) {
      // 1st quadrant (TR): [0, π/2] and adjacent
      searchRanges = [
        [0, Math.PI / 2],
        [(7 * Math.PI) / 4, 2 * Math.PI], // Adjacent to 1st quadrant
      ];
    } else if (!isPositiveX && isPositiveY) {
      // 2nd quadrant (TL): [π/2, π] and adjacent
      searchRanges = [
        [Math.PI / 2, Math.PI],
        [0, Math.PI / 4], // Adjacent to 2nd quadrant
      ];
    } else {
      // 3rd quadrant (BL): [π, 3π/2] and adjacent
      // For BL, we need to search more thoroughly since the ellipse might not pass through it
      searchRanges = [
        [Math.PI, (3 * Math.PI) / 2],
        [(3 * Math.PI) / 2, (7 * Math.PI) / 4], // Adjacent to 3rd quadrant
        [(5 * Math.PI) / 4, Math.PI], // Also check this range
      ];
    }

    // Also search adjacent quadrants if needed
    for (const [startRange, endRange] of searchRanges) {
      for (
        let testTheta = startRange;
        testTheta < endRange;
        testTheta += searchStep
      ) {
        const [testX_math, testY_math] = getEllipsePosMath(testTheta);
        const testError = Math.hypot(
          testX_math - START_VERTEX_X,
          testY_math - START_VERTEX_Y
        );
        if (testError < bestError) {
          bestError = testError;
          bestTheta = testTheta;
          if (bestError < 0.5) break; // Early exit if good enough
        }
      }
      if (bestError < 0.5) break;
    }

    // If still not good enough, search all quadrants with finer step
    if (bestError > 0.5) {
      const allRanges = [
        [0, Math.PI / 2],
        [Math.PI / 2, Math.PI],
        [Math.PI, (3 * Math.PI) / 2],
        [(3 * Math.PI) / 2, 2 * Math.PI],
      ];
      const fineSearchStep = 0.002; // Even finer step for exhaustive search
      for (const [startRange, endRange] of allRanges) {
        for (
          let testTheta = startRange;
          testTheta < endRange;
          testTheta += fineSearchStep
        ) {
          const [testX_math, testY_math] = getEllipsePosMath(testTheta);
          const testError = Math.hypot(
            testX_math - START_VERTEX_X,
            testY_math - START_VERTEX_Y
          );
          if (testError < bestError) {
            bestError = testError;
            bestTheta = testTheta;
            if (bestError < 0.1) break; // Early exit if very close
          }
        }
        if (bestError < 0.1) break;
      }
    }

    // If error is still large, the ellipse might not pass through this vertex exactly
    // In that case, find the closest point on the ellipse to the vertex
    // For BL, we MUST find a good match, so do exhaustive search
    // Also check if current best is on the circle (wrong solution)
    const currentBestDist = Math.hypot(
      getEllipsePosMath(bestTheta)[0],
      getEllipsePosMath(bestTheta)[1]
    );
    const isCurrentBestOnCircle = Math.abs(currentBestDist - circleRadius) < 5;
    const expectedDistFromCenter = Math.hypot(START_VERTEX_X, START_VERTEX_Y);
    const shouldDoExhaustive =
      bestError > 1.0 ||
      (startVertex === "BL" &&
        (bestError > 0.5 ||
          isCurrentBestOnCircle ||
          (currentBestDist < 50 && expectedDistFromCenter > 100)));

    if (shouldDoExhaustive) {
      if (DEBUG && startVertex === "BL") {
        console.log(
          `🔍 Running exhaustive search for BL: bestError=${bestError.toFixed(
            2
          )}, currentBestDist=${currentBestDist.toFixed(
            2
          )}, isOnCircle=${isCurrentBestOnCircle}`
        );
      }

      // For BL, we MUST find a point far from center (>100px), not near center or on circle
      // Reset bestError if current best is too close to center
      if (startVertex === "BL") {
        if (isCurrentBestOnCircle || currentBestDist < 100) {
          if (DEBUG) {
            console.log(
              `  ⚠️ Current best is too close to center (${currentBestDist.toFixed(
                2
              )}px) or on circle, resetting bestError to force finding point far from center (>100px)`
            );
          }
          bestError = Infinity; // Force finding a new point
        }
      }

      // Do a very fine search across the entire ellipse
      // For BL, use even finer step to ensure we find the right point
      const veryFineStep = startVertex === "BL" ? 0.0005 : 0.001;

      for (
        let testTheta = 0;
        testTheta < 2 * Math.PI;
        testTheta += veryFineStep
      ) {
        const [testX_math, testY_math] = getEllipsePosMath(testTheta);
        const testError = Math.hypot(
          testX_math - START_VERTEX_X,
          testY_math - START_VERTEX_Y
        );
        const testDistFromCenter = Math.hypot(testX_math, testY_math);
        const testIsOnCircle = Math.abs(testDistFromCenter - circleRadius) < 5;

        // For BL, ONLY accept points that are:
        // 1. Far from center (>100px) - BL should be at ~141px
        // 2. NOT on the circle
        // 3. Close to BL vertex
        if (startVertex === "BL") {
          if (testIsOnCircle || testDistFromCenter < 100) {
            continue; // Skip points near center or on circle for BL
          }
        }

        if (testError < bestError) {
          bestError = testError;
          bestTheta = testTheta;
          // For BL, be more strict - we want a very close match
          if (startVertex === "BL" && bestError < 0.05) break;
          if (bestError < 0.1) break;
        }
      }

      // Validate: ensure we're not at the center (for BL, this is critical)
      if (startVertex === "BL") {
        const [finalX, finalY] = getEllipsePosMath(bestTheta);
        const distFromCenter = Math.hypot(finalX, finalY);
        const distFromTarget = Math.hypot(
          finalX - START_VERTEX_X,
          finalY - START_VERTEX_Y
        );

        // If we're too close to center OR on the circle (radius ~30), the search failed
        // BL should be far from center (~141px), not on the circle
        // For BL, we require distance > 100px from center
        const isOnCircle = Math.abs(distFromCenter - circleRadius) < 5;
        if ((distFromCenter < 100 || isOnCircle) && distFromTarget > 50) {
          if (DEBUG) {
            console.warn(
              `⚠️ BL search found point near center (${finalX.toFixed(
                2
              )}, ${finalY.toFixed(
                2
              )}), distance from center: ${distFromCenter.toFixed(2)}px`
            );
            console.warn(
              `  This suggests the search converged to wrong solution. Trying alternative search...`
            );
          }

          // Try searching specifically in the 3rd quadrant with very fine steps
          const quadrant3Start = Math.PI;
          const quadrant3End = (3 * Math.PI) / 2;
          const ultraFineStep = 0.0001;
          let bestQuadrant3Theta = bestTheta;
          let bestQuadrant3Error = bestError;

          for (
            let testTheta = quadrant3Start;
            testTheta < quadrant3End;
            testTheta += ultraFineStep
          ) {
            const [testX_math, testY_math] = getEllipsePosMath(testTheta);
            const testError = Math.hypot(
              testX_math - START_VERTEX_X,
              testY_math - START_VERTEX_Y
            );
            const testDistFromCenter = Math.hypot(testX_math, testY_math);
            const testIsOnCircle =
              Math.abs(testDistFromCenter - circleRadius) < 5;

            // Prefer points that are far from center, NOT on the circle, and close to target
            // BL should be at distance ~141px (major axis), not 30px (circle radius)
            // For BL, we require distance > 100px from center
            if (
              testError < bestQuadrant3Error &&
              testDistFromCenter > 100 &&
              !testIsOnCircle
            ) {
              bestQuadrant3Error = testError;
              bestQuadrant3Theta = testTheta;
              if (testError < 0.05) break;
            }
          }

          // Use the quadrant 3 result if it's better
          if (
            bestQuadrant3Error < bestError ||
            (bestQuadrant3Error < 100 && distFromCenter < 50)
          ) {
            bestError = bestQuadrant3Error;
            bestTheta = bestQuadrant3Theta;
            if (DEBUG) {
              const [newX, newY] = getEllipsePosMath(bestTheta);
              console.log(
                `  Found better solution in quadrant 3: theta=${(
                  (bestTheta * 180) /
                  Math.PI
                ).toFixed(2)}°, point=(${newX.toFixed(2)}, ${newY.toFixed(
                  2
                )}), error=${bestError.toFixed(2)}px`
              );
            }
          }
        }
      }
    }

    START_THETA = bestTheta;
    const [verifyStartX_math_new, verifyStartY_math_new] =
      getEllipsePosMath(START_THETA);
    startError = Math.hypot(
      verifyStartX_math_new - START_VERTEX_X,
      verifyStartY_math_new - START_VERTEX_Y
    );
    // Update screen coords for display
    const [verifyStartX_new, verifyStartY_new] = getEllipsePos(START_THETA);
    verifyStartX = verifyStartX_new;
    verifyStartY = verifyStartY_new;
  }

  // Debug logging - only in development mode
  if (DEBUG) {
    console.clear();
    console.log("=== SPARK CIRCLE DEBUG ===");
    console.log(`Ellipse Parameters:`);
    console.log(
      `  Semi-major axis a = ${a.toFixed(4)} (calculated as diagonal/2)`
    );
    if (rect) {
      const diagonal = Math.hypot(rect.width, rect.height);
      console.log(
        `    Betspot: ${rect.width}x${
          rect.height
        }, diagonal = ${diagonal.toFixed(4)}, a = ${diagonal.toFixed(
          4
        )}/2 = ${a.toFixed(4)}`
      );
    }
    console.log(
      `  Semi-minor axis b = ${b.toFixed(
        4
      )} (equals circle radius = ${circleRadius})`
    );
    console.log(
      `  Rotation angle = ${((rotAngleRad * 180) / Math.PI).toFixed(
        2
      )}° (3π/4 rad)`
    );
    console.log(`  Major axis direction: along y = -x`);
    console.log(`Circle radius: ${circleRadius}`);
    console.log(`Center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)})`);
    console.log(`\nPath Points:`);
    if (rect) {
      console.log(`Betspot size: ${rect.width}x${rect.height}`);
    }
    console.log(
      `Start vertex (${startVertex}) (math coords, relative to center): (${START_VERTEX_X.toFixed(
        2
      )}, ${START_VERTEX_Y.toFixed(2)})`
    );
    const [startX_math, startY_math] = getEllipsePosMath(START_THETA);
    console.log(
      `Start theta: ${((START_THETA * 180) / Math.PI).toFixed(
        2
      )}° -> math: (${startX_math.toFixed(2)}, ${startY_math.toFixed(
        2
      )}), screen: (${(verifyStartX - centerX).toFixed(2)}, ${(
        verifyStartY - centerY
      ).toFixed(2)})`
    );
    console.log(`Start point error: ${startError.toFixed(4)}px`);
    const [meetingX_math, meetingY_math] = getEllipsePosMath(MEETING_THETA);
    console.log(
      `Meeting theta: ${((MEETING_THETA * 180) / Math.PI).toFixed(
        2
      )}° -> math: (${meetingX_math.toFixed(2)}, ${meetingY_math.toFixed(
        2
      )}), screen: (${(verifyMeetingX - centerX).toFixed(2)}, ${(
        verifyMeetingY - centerY
      ).toFixed(2)})`
    );
    console.log(
      `Expected meeting point: (${meetingPointX.toFixed(
        2
      )}, ${meetingPointY.toFixed(2)})`
    );
    console.log(`Meeting point error: ${meetingError.toFixed(4)}px`);

    // Warn if start point error is too large
    if (startError > 1.0) {
      const [finalX_math, finalY_math] = getEllipsePosMath(START_THETA);
      const distFromCenter = Math.hypot(finalX_math, finalY_math);
      console.warn(
        `⚠️ Start point calculation has large error! Expected ${startVertex} at (${START_VERTEX_X}, ${START_VERTEX_Y}), got (${finalX_math.toFixed(
          2
        )}, ${finalY_math.toFixed(2)}) in math coords`
      );
      console.warn(
        `  Error: ${startError.toFixed(
          2
        )}px, Distance from center: ${distFromCenter.toFixed(2)}px, Theta: ${(
          (START_THETA * 180) /
          Math.PI
        ).toFixed(2)}°`
      );

      // For BL, if we're near center, this is a critical issue
      if (startVertex === "BL" && distFromCenter < 50) {
        console.error(
          `❌ CRITICAL: BL animation starting from center instead of BL vertex!`
        );
        console.error(
          `  This will cause the animation to start from the wrong position.`
        );
      }
    }

    // If meeting point error is too large, warn
    if (meetingError > 1.0) {
      console.warn(
        `⚠️ Meeting point calculation has large error! Expected (${meetingPointX}, ${meetingPointY}) in math coords, got (${meetingX_math.toFixed(
          2
        )}, ${meetingY_math.toFixed(2)}) in math coords`
      );
      console.warn(
        `  This might cause the animation to not transition smoothly from ellipse to circle.`
      );
    }
  }

  // Pre-calculate path lengths and portions once (performance optimization)
  // Sample ellipse path from START_THETA to MEETING_THETA (clockwise)
  const ellipseSamples = 64; // Reduced from 128 for better performance
  let ellipsePathLength = 0;
  let [prevX, prevY] = getEllipsePos(START_THETA);
  for (let i = 1; i <= ellipseSamples; i++) {
    const thetaT = i / ellipseSamples;
    // Interpolate from START_THETA to MEETING_THETA
    // Handle wrap-around if needed
    let theta = START_THETA + (MEETING_THETA - START_THETA) * thetaT;
    // Normalize to [0, 2π]
    if (theta < 0) theta += 2 * Math.PI;
    else if (theta >= 2 * Math.PI) theta -= 2 * Math.PI;

    const [x, y] = getEllipsePos(theta);
    ellipsePathLength += Math.hypot(x - prevX, y - prevY);
    prevX = x;
    prevY = y;
  }

  // Circle path: 2 full rotations (4π) only - no spiral to center
  const circleRotations = 2; // 2 full rotations
  let circlePathLength = circleRotations * 2 * Math.PI * circleRadius; // Rotation part only

  const totalPathLength = ellipsePathLength + circlePathLength;
  const ellipsePortion = ellipsePathLength / totalPathLength;
  const circlePortion = circlePathLength / totalPathLength;

  // Cache these values to avoid recalculating
  const cachedEllipsePortion = ellipsePortion;
  const cachedCirclePortion = circlePortion;
  const cachedCircleRotations = circleRotations;

  // Pre-calculate meeting circle angle once (performance optimization)
  const [meetingX_math, meetingY_math] = getEllipsePosMath(MEETING_THETA);
  const cachedMeetingCircleAngle = Math.atan2(meetingY_math, meetingX_math);

  // Pre-calculate rotation values (cached for performance)
  const cachedTotalRotation = cachedCircleRotations * 2 * Math.PI; // 2 full rotations = 4π

  const getPathPosition = (t) => {
    if (t <= cachedEllipsePortion) {
      // Ellipse portion: from BR to meeting point
      const ellipseT = t / cachedEllipsePortion;
      let theta = START_THETA + (MEETING_THETA - START_THETA) * ellipseT;
      // Normalize to [0, 2π] - optimized
      if (theta < 0) theta += 2 * Math.PI;
      else if (theta >= 2 * Math.PI) theta -= 2 * Math.PI;

      return getEllipsePos(theta);
    } else {
      // Circle portion: from meeting point, rotate 2 times clockwise, then disappear
      const circleT = (t - cachedEllipsePortion) / cachedCirclePortion;

      // Rotate 2 full times clockwise
      // In math coords (Y+ up), clockwise = decreasing angle (negative direction)
      const angle = cachedMeetingCircleAngle - cachedTotalRotation * circleT; // Negative for clockwise
      // Circle position in math coords
      const x_math = circleRadius * Math.cos(angle);
      const y_math = circleRadius * Math.sin(angle);
      // Convert to screen coords (flip Y)
      const x = x_math + centerX;
      const y = -y_math + centerY;
      return [x, y];
    }
  };

  // Optimize path length calculation: use fewer samples and cache intermediate values
  let [px0, py0] = getPathPosition(0);
  let total = 0;
  // Use adaptive sampling: more samples at the beginning (ellipse) where curvature is higher
  const ellipseSamplesForLength = Math.floor(SAMPLES * cachedEllipsePortion);
  const circleSamplesForLength = SAMPLES - ellipseSamplesForLength;

  // Sample ellipse portion
  for (let i = 1; i <= ellipseSamplesForLength; i++) {
    const t = (i / ellipseSamplesForLength) * cachedEllipsePortion;
    const [px, py] = getPathPosition(t);
    total += Math.hypot(px - px0, py - py0);
    px0 = px;
    py0 = py;
  }

  // Sample circle portion
  for (let i = 1; i <= circleSamplesForLength; i++) {
    const t =
      cachedEllipsePortion + (i / circleSamplesForLength) * cachedCirclePortion;
    const [px, py] = getPathPosition(t);
    total += Math.hypot(px - px0, py - py0);
    px0 = px;
    py0 = py;
  }

  return {
    pathLength: total,
    startTheta: START_THETA,
    meetingTheta: MEETING_THETA,
  };
}

export function drawSparkCircle({
  gl,
  canvas,
  anchorCenter,
  timeNowSec,
  globalConfig,
  pathConfig,
  easedNormalizedTime,
  totalArcPx,
  startTheta,
  meetingTheta,
  rotAngle: providedRotAngle, // Rotation angle passed from GlowAnimation
}) {
  if (!gl) return;
  const { program, attribs, uniforms: u } = getProgramBundle(gl);

  const merged = {
    animationTimeMs: resolveNumber(
      pathConfig.animationTimeMs,
      globalConfig.animationTimeMs
    ),
    glowRadius: resolveNumber(pathConfig.glowRadius, globalConfig.glowRadius),
    headRadius: resolveNumber(
      pathConfig.headRadius,
      globalConfig.headRadius ?? 10
    ),
    tailRadius: resolveNumber(
      pathConfig.tailRadius,
      globalConfig.tailRadius ?? 2
    ),
    length: resolveNumber(pathConfig.length, globalConfig.length),
    delay: resolveNumber(pathConfig.delay, 0),
    ellipse: pathConfig.ellipse || globalConfig.ellipse || { a: 150, b: 20 },
    circleRadius: resolveNumber(pathConfig.circleRadius, 30),
    overshoot: resolveNumber(
      pathConfig.overshoot,
      globalConfig.overshoot ?? 0.08
    ),
    fadeWindow: resolveNumber(
      pathConfig.fadeWindow,
      globalConfig.fadeWindow ?? 0.08
    ),
    sparkColor: pathConfig.sparkColor ?? globalConfig.sparkColor ?? "#ffffe0",
    glowColor: pathConfig.glowColor ?? globalConfig.glowColor ?? "#fffba4",
  };

  // Rotation angle is passed from GlowAnimation based on start vertex:
  // BR or TL: 135° (3π/4) - major axis along y = -x (BR↔TL diagonal)
  // BL or TR: 45° (π/4) - major axis along y = x (BL↔TR diagonal)
  const rotAngle = providedRotAngle ?? (135 * Math.PI) / 180; // Default to 135° if not provided

  // Get ellipse parameters
  // For circle paths, a should be calculated from diagonal/2, not from config
  // Use the values from pathConfig which should have the correct a and b
  const a = merged.ellipse.a || 70.7107; // Fallback to 50√2
  const b = merged.ellipse.b || 30; // Should equal circleRadius

  gl.useProgram(program);

  gl.uniform2f(u.resolutionLocation, canvas.width, canvas.height);
  gl.uniform2f(u.centerLocation, anchorCenter[0], anchorCenter[1]);
  gl.uniform1f(u.timeLocation, timeNowSec);
  gl.uniform1f(u.delayLocation, delayToSeconds(merged.delay));
  gl.uniform1f(u.animationTimeLocation, merged.animationTimeMs / 1000.0);
  gl.uniform1f(u.headRadiusLocation, merged.headRadius);
  gl.uniform1f(u.tailRadiusLocation, merged.tailRadius);
  gl.uniform1f(u.glowRadiusLocation, merged.glowRadius);
  gl.uniform1f(u.lineLengthLocation, merged.length);
  gl.uniform1f(u.totalArcPxLocation, totalArcPx || 1.0);
  gl.uniform1f(u.aLocation, a);
  gl.uniform1f(u.bLocation, b);
  gl.uniform1f(u.rotAngleLocation, rotAngle);
  gl.uniform1f(u.circleRadiusLocation, merged.circleRadius);
  // Use provided theta values or calculate them if not provided
  const startThetaValue = startTheta ?? 0;
  const meetingThetaValue = meetingTheta ?? 0;
  gl.uniform1f(u.startThetaLocation, startThetaValue);
  gl.uniform1f(u.meetingThetaLocation, meetingThetaValue);
  gl.uniform1f(u.overshootLocation, merged.overshoot);
  gl.uniform1f(u.fadeWindowLocation, merged.fadeWindow);
  gl.uniform1f(u.easedNormalizedTimeLocation, easedNormalizedTime);

  // Set colors - ensure we have valid hex strings, with caching
  const sparkColorHex =
    typeof merged.sparkColor === "string" ? merged.sparkColor : "#ffffe0";
  const glowColorHex =
    typeof merged.glowColor === "string" ? merged.glowColor : "#fffba4";

  // Cache color conversions to avoid regex on every frame
  let sparkRgb = colorCache.get(sparkColorHex);
  if (!sparkRgb) {
    sparkRgb = hexToRgb(sparkColorHex);
    colorCache.set(sparkColorHex, sparkRgb);
  }

  let glowRgb = colorCache.get(glowColorHex);
  if (!glowRgb) {
    glowRgb = hexToRgb(glowColorHex);
    colorCache.set(glowColorHex, glowRgb);
  }

  gl.uniform3f(u.sparkColorLocation, sparkRgb[0], sparkRgb[1], sparkRgb[2]);
  gl.uniform3f(u.glowColorLocation, glowRgb[0], glowRgb[1], glowRgb[2]);

  gl.enableVertexAttribArray(attribs.positionLocation);
  gl.vertexAttribPointer(attribs.positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

export function disposeSparkCircle(gl) {
  const bundle = programCache.get(gl);
  if (bundle && bundle.program) {
    gl.deleteProgram(bundle.program);
  }
  programCache.delete(gl);
}
