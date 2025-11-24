import { resolveNumber, resolveEllipse, delayToSeconds } from "./utils";
import { EPSILON } from "./constants";
import * as sparkAnimation from "./animations/spark";
import * as circleAnimation from "./animations/circle";
import * as lineAnimation from "./animations/line";

function mergeConfig(pathConfig, globalConfig) {
  return {
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
    ellipseTiltDeg: resolveNumber(
      pathConfig.ellipseTiltDeg,
      globalConfig.ellipseTiltDeg ?? 0
    ),
    ellipseRotationDeg: resolveNumber(
      pathConfig.ellipseRotationDeg,
      globalConfig.ellipseRotationDeg ?? 0
    ),
    direction: pathConfig.direction ?? globalConfig.direction ?? "auto",
    fadeIn: resolveNumber(pathConfig.fadeIn, globalConfig.fadeIn ?? 0),
    fadeOut: resolveNumber(pathConfig.fadeOut, globalConfig.fadeOut ?? 0),
    lineWidth: (() => {
      let pathValue = pathConfig.lineWidth;
      let globalValue = globalConfig.lineWidth;

      if (typeof pathValue === "string") {
        pathValue = Number.parseFloat(pathValue);
      }
      if (typeof globalValue === "string") {
        globalValue = Number.parseFloat(globalValue);
      }

      if (
        typeof pathValue === "number" &&
        !Number.isNaN(pathValue) &&
        pathValue > 0
      ) {
        return pathValue;
      }
      if (
        typeof globalValue === "number" &&
        !Number.isNaN(globalValue) &&
        globalValue > 0
      ) {
        return globalValue;
      }
      return 1;
    })(),
    iterations: resolveNumber(
      pathConfig.iterations,
      globalConfig.iterations ?? 1
    ),
    lineLength:
      pathConfig.length !== undefined &&
      typeof pathConfig.length === "number" &&
      pathConfig.length > 0
        ? pathConfig.length
        : undefined,
    startPoint: resolveNumber(
      pathConfig.startPoint,
      globalConfig.startPoint ?? 0
    ),
  };
}

function calculateFadeAlpha(merged, elapsed, durationSec) {
  let fadeInAlpha = 1.0;
  let fadeOutAlpha = 1.0;

  if (merged.fadeIn > 0) {
    const fadeInSec = merged.fadeIn / 1000.0;
    const fadeInProgress = Math.min(1.0, Math.max(0.0, elapsed / fadeInSec));
    fadeInAlpha = fadeInProgress;
  }

  if (merged.fadeOut > 0) {
    const fadeOutSec = merged.fadeOut / 1000.0;
    const timeUntilEnd = durationSec - elapsed;
    const fadeOutProgress = Math.min(
      1.0,
      Math.max(0.0, timeUntilEnd / fadeOutSec)
    );
    fadeOutAlpha = fadeOutProgress;
  }

  return fadeInAlpha * fadeOutAlpha;
}

function calculatePhase(
  isLinePath,
  easedNormalizedTime,
  totalArcPx,
  merged
) {
  const totalArcPxVal = Math.max(totalArcPx || 1.0, EPSILON);
  const segmentParam = isLinePath
    ? 0
    : Math.min(merged.length / totalArcPxVal, 1.0);
  const totalSpan = isLinePath ? 1.0 : 1.0 + segmentParam + merged.overshoot;
  const phase = easedNormalizedTime * totalSpan;
  const maxPhase = totalSpan;

  const segHead = Math.min(Math.max(phase, 0), totalSpan);
  const segTail = Math.min(Math.max(phase - segmentParam, 0), totalSpan);

  return { phase, maxPhase, segHead, segTail, totalSpan, segmentParam };
}

function calculateAlpha(
  isLinePath,
  phase,
  maxPhase,
  segTail,
  merged,
  fadeAlpha
) {
  if (!isLinePath && phase >= maxPhase + merged.fadeWindow - EPSILON) {
    return 0;
  }

  if (!isLinePath && segTail >= 1.0 - EPSILON) {
    const pastEnd = phase - 1.0;
    if (pastEnd >= merged.fadeWindow) {
      return 0;
    }
  }

  let alpha = 1.0;

  if (merged.fadeOut <= 0 && !isLinePath) {
    if (phase > maxPhase) {
      const fadeMul =
        1.0 -
        Math.min((phase - maxPhase) / Math.max(merged.fadeWindow, EPSILON), 1.0);
      alpha *= fadeMul;
    } else if (segTail >= 1.0 - EPSILON) {
      const pastEnd = Math.max(0.0, phase - 1.0);
      const fadeOutPhase = Math.min(
        pastEnd / Math.max(merged.fadeWindow, EPSILON),
        1.0
      );
      alpha *= 1.0 - fadeOutPhase;
    }
  }

  alpha *= fadeAlpha;

  return alpha;
}

export function renderPath({
  ctx,
  anchorCenter,
  timeNowSec,
  globalConfig,
  pathConfig,
  easedNormalizedTime,
  totalArcPx,
  metrics,
  isCirclePath,
  isLinePath,
  anchorEl,
  elapsed,
  durationSec,
}) {
  const merged = mergeConfig(pathConfig, globalConfig);

  const delaySec = delayToSeconds(merged.delay);
  const adjustedTime = timeNowSec - delaySec;
  if (adjustedTime < 0) return;

  const fadeAlpha = calculateFadeAlpha(merged, elapsed, durationSec);
  const { phase, maxPhase, segHead, segTail, totalSpan } = calculatePhase(
    isLinePath,
    easedNormalizedTime,
    totalArcPx,
    merged
  );

  const alpha = calculateAlpha(
    isLinePath,
    phase,
    maxPhase,
    segTail,
    merged,
    fadeAlpha
  );

  if (alpha <= 0) {
    return;
  }

  if (isLinePath) {
    lineAnimation.renderLine(
      ctx,
      pathConfig,
      globalConfig,
      metrics,
      easedNormalizedTime,
      alpha
    );
  } else if (isCirclePath) {
    circleAnimation.renderCircle(
      ctx,
      pathConfig,
      globalConfig,
      metrics,
      segTail,
      segHead,
      totalSpan,
      alpha
    );
  } else {
    sparkAnimation.renderSpark(
      ctx,
      pathConfig,
      globalConfig,
      metrics,
      segTail,
      segHead,
      totalSpan,
      alpha,
      anchorEl
    );
  }
}

