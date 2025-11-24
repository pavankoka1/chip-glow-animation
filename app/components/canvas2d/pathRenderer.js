import { resolveNumber, delayToSeconds } from "./utils";
import { EPSILON } from "./constants";
import * as sparkAnimation from "./animations/spark";
import * as circleAnimation from "./animations/circle";
import * as lineAnimation from "./animations/line";

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
  rect,
}) {
  const delay = resolveNumber(pathConfig.delay, 0);
  const delaySec = delayToSeconds(delay);
  const adjustedTime = timeNowSec - delaySec;
  if (adjustedTime < 0) return;

  const length = resolveNumber(pathConfig.length, globalConfig.length);
  const overshoot = resolveNumber(pathConfig.overshoot, globalConfig.overshoot ?? 0.08);
  const fadeWindow = resolveNumber(pathConfig.fadeWindow, globalConfig.fadeWindow ?? 0.08);
  const fadeIn = resolveNumber(pathConfig.fadeIn, globalConfig.fadeIn ?? 0);
  const fadeOut = resolveNumber(pathConfig.fadeOut, globalConfig.fadeOut ?? 0);

  let fadeInAlpha = 1.0;
  if (fadeIn > 0) {
    const fadeInSec = fadeIn / 1000.0;
    fadeInAlpha = Math.min(1.0, Math.max(0.0, elapsed / fadeInSec));
  }

  let fadeOutAlpha = 1.0;
  if (fadeOut > 0) {
    const fadeOutSec = fadeOut / 1000.0;
    const timeUntilEnd = durationSec - elapsed;
    fadeOutAlpha = Math.min(1.0, Math.max(0.0, timeUntilEnd / fadeOutSec));
  }

  const fadeAlpha = fadeInAlpha * fadeOutAlpha;

  const totalArcPxVal = Math.max(totalArcPx || 1.0, EPSILON);
  const segmentParam = isLinePath ? 0 : Math.min(length / totalArcPxVal, 1.0);
  const totalSpan = isLinePath ? 1.0 : 1.0 + segmentParam + overshoot;
  const phase = easedNormalizedTime * totalSpan;
  const maxPhase = totalSpan;

  if (!isLinePath && phase >= maxPhase + fadeWindow - EPSILON) return;

  const segHead = Math.min(Math.max(phase, 0), totalSpan);
  const segTail = Math.min(Math.max(phase - segmentParam, 0), totalSpan);

  if (!isLinePath && segTail >= 1.0 - EPSILON) {
    const pastEnd = phase - 1.0;
    if (pastEnd >= fadeWindow) return;
  }

  let alpha = 1.0;

  if (fadeOut <= 0 && !isLinePath) {
    if (phase > maxPhase) {
      const fadeMul = 1.0 - Math.min((phase - maxPhase) / Math.max(fadeWindow, EPSILON), 1.0);
      alpha *= fadeMul;
    } else if (segTail >= 1.0 - EPSILON) {
      const pastEnd = Math.max(0.0, phase - 1.0);
      const fadeOutPhase = Math.min(pastEnd / Math.max(fadeWindow, EPSILON), 1.0);
      alpha *= 1.0 - fadeOutPhase;
    }
  }

  alpha *= fadeAlpha;

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
      rect
    );
  }
}

