import { CAMERA_DISTANCE } from "./constants";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders";
import { getAngleForVertex, resolveEllipse, resolveNumber } from "./utils";

// Cache a single compiled program per WebGL context
const programCache = new WeakMap();

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  // FIX: use the shader object in getShaderParameter
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
  const v = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const f = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
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
    cameraDistanceLocation: gl.getUniformLocation(program, "u_cameraDistance"),
    lineLengthLocation: gl.getUniformLocation(program, "u_lineLength"),
    totalArcPxLocation: gl.getUniformLocation(program, "u_totalArcPx"),
    aLocation: gl.getUniformLocation(program, "u_a"),
    bLocation: gl.getUniformLocation(program, "u_b"),
    rotAngleLocation: gl.getUniformLocation(program, "u_rotAngle"),
    thetaStartLocation: gl.getUniformLocation(program, "u_thetaStart"),
    thetaEndLocation: gl.getUniformLocation(program, "u_thetaEnd"),
    dirLocation: gl.getUniformLocation(program, "u_dir"),
    rotExtraLocation: gl.getUniformLocation(program, "u_rotExtra"),
    tiltXLocation: gl.getUniformLocation(program, "u_tiltX"),
    tiltYLocation: gl.getUniformLocation(program, "u_tiltY"),
    depthAmpLocation: gl.getUniformLocation(program, "u_depthAmp"),
    depthPhaseLocation: gl.getUniformLocation(program, "u_depthPhase"),
    overshootLocation: gl.getUniformLocation(program, "u_overshoot"),
    fadeWindowLocation: gl.getUniformLocation(program, "u_fadeWindow"),
    easedNormalizedTimeLocation: gl.getUniformLocation(
      program,
      "u_easedNormalizedTime"
    ),
    ellipseTiltDegLocation: gl.getUniformLocation(program, "u_ellipseTiltDeg"),
    sparkColorLocation: gl.getUniformLocation(program, "u_sparkColor"),
    glowColorLocation: gl.getUniformLocation(program, "u_glowColor"),
  };
  bundle = { program, attribs, uniforms };
  programCache.set(gl, bundle);
  return bundle;
}

function normalizeDelta(angle) {
  let a = angle;
  const twoPi = Math.PI * 2;
  a = ((((a + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI; // wrap to (-PI, PI]
  return a;
}

function delayToSeconds(v) {
  if (typeof v !== "number" || isNaN(v)) return 0;
  return v > 20 ? v / 1000 : v; // treat large values as ms
}

function degToRad(d) {
  return (d * Math.PI) / 180;
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

export function drawSpark({
  gl,
  canvas,
  anchorCenter,
  timeNowSec,
  globalConfig,
  pathConfig,
  easedNormalizedTime,
  totalArcPx,
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
    ellipse: resolveEllipse(pathConfig.ellipse, globalConfig.ellipse),
    cameraDistance: resolveNumber(
      pathConfig.cameraDistance,
      globalConfig.cameraDistance
    ),
    viewTiltXDeg: resolveNumber(
      pathConfig.viewTiltXDeg,
      globalConfig.viewTiltXDeg
    ),
    viewTiltYDeg: resolveNumber(
      pathConfig.viewTiltYDeg,
      globalConfig.viewTiltYDeg
    ),
    depthAmplitude: resolveNumber(
      pathConfig.depthAmplitude,
      globalConfig.depthAmplitude
    ),
    depthPhaseDeg: resolveNumber(
      pathConfig.depthPhaseDeg,
      globalConfig.depthPhaseDeg
    ),
    ellipseRotationDeg: resolveNumber(pathConfig.ellipseRotationDeg, 0),
    overshoot: resolveNumber(
      pathConfig.overshoot,
      globalConfig.overshoot ?? 0.08
    ),
    fadeWindow: resolveNumber(
      pathConfig.fadeWindow,
      globalConfig.fadeWindow ?? 0.08
    ),
    ellipseTiltDeg: resolveNumber(
      pathConfig.ellipseTiltDeg,
      globalConfig.ellipseTiltDeg ?? 0
    ),
    sparkColor: pathConfig.sparkColor ?? globalConfig.sparkColor ?? "#ffffe0",
    glowColor: pathConfig.glowColor ?? globalConfig.glowColor ?? "#fffba4",
  };

  const startDir = getAngleForVertex(pathConfig.startVertex);
  const endDir = getAngleForVertex(pathConfig.endVertex);
  let delta = normalizeDelta(endDir - startDir);
  let dir = Math.sign(delta);
  if (dir == 0) {
    // Same vertex: default to half-ellipse
    delta = Math.PI;
    dir = 1;
  }
  const thetaStartLocal = 0.0;
  const thetaEndLocal = Math.abs(delta);
  const rotAngle = startDir; // align local 0 with start direction
  const rotExtra = degToRad(merged.ellipseRotationDeg);

  gl.useProgram(program);

  gl.uniform2f(u.resolutionLocation, canvas.width, canvas.height);
  gl.uniform2f(u.centerLocation, anchorCenter[0], anchorCenter[1]);
  gl.uniform1f(u.timeLocation, timeNowSec);
  gl.uniform1f(u.delayLocation, delayToSeconds(merged.delay));
  gl.uniform1f(u.animationTimeLocation, merged.animationTimeMs / 1000.0);
  gl.uniform1f(u.headRadiusLocation, merged.headRadius);
  gl.uniform1f(u.tailRadiusLocation, merged.tailRadius);
  gl.uniform1f(u.glowRadiusLocation, merged.glowRadius);
  gl.uniform1f(
    u.cameraDistanceLocation,
    resolveNumber(merged.cameraDistance, CAMERA_DISTANCE)
  );
  gl.uniform1f(u.lineLengthLocation, merged.length);
  gl.uniform1f(u.totalArcPxLocation, totalArcPx || 1.0);
  gl.uniform1f(u.aLocation, merged.ellipse.a);
  gl.uniform1f(u.bLocation, merged.ellipse.b);
  gl.uniform1f(u.rotAngleLocation, rotAngle);
  gl.uniform1f(u.thetaStartLocation, thetaStartLocal);
  gl.uniform1f(u.thetaEndLocation, thetaEndLocal);
  gl.uniform1f(u.dirLocation, dir);
  gl.uniform1f(u.rotExtraLocation, rotExtra);
  gl.uniform1f(u.tiltXLocation, degToRad(merged.viewTiltXDeg));
  gl.uniform1f(u.tiltYLocation, degToRad(merged.viewTiltYDeg));
  gl.uniform1f(u.depthAmpLocation, merged.depthAmplitude);
  gl.uniform1f(u.depthPhaseLocation, degToRad(merged.depthPhaseDeg));
  gl.uniform1f(u.overshootLocation, merged.overshoot);
  gl.uniform1f(u.fadeWindowLocation, merged.fadeWindow);
  gl.uniform1f(u.easedNormalizedTimeLocation, easedNormalizedTime);
  gl.uniform1f(u.ellipseTiltDegLocation, merged.ellipseTiltDeg);

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

export function disposeSpark(gl) {
  const bundle = programCache.get(gl);
  if (bundle && bundle.program) {
    gl.deleteProgram(bundle.program);
  }
  programCache.delete(gl);
}
