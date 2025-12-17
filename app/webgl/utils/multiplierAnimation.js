import { delayToSeconds } from "../../components/canvas2d/utils";

export function updateMultiplierAnimations(
  index,
  currentTimeSec,
  multiplierRefs,
  config
) {
  const multiplierElements = multiplierRefs.current[index];
  if (!multiplierElements || multiplierElements.length === 0) return;

  const multiplierPaths = (config.paths || []).filter(
    (p) => p.type === "multiplier" && p.enabled !== false
  );

  multiplierPaths.forEach((multiplierPath, pathIndex) => {
    const multiplierEl = multiplierElements[pathIndex];
    if (!multiplierEl) return;

    const delayRaw = multiplierPath.delay || 0;
    const delaySec = delayToSeconds(delayRaw);
    const elapsed = Math.max(0, currentTimeSec - delaySec);
    const durationSec = (multiplierPath.animationTimeMs || 1930) / 1000.0;

    const PHASE1_DURATION = (multiplierPath.phase1Duration || 130) / 1000.0;
    const PHASE2_DURATION = (multiplierPath.phase2Duration || 250) / 1000.0;
    const PHASE3_DURATION = (multiplierPath.phase3Duration || 1250) / 1000.0;
    const PHASE4_DURATION = (multiplierPath.phase4Duration || 300) / 1000.0;
    const maxScale = multiplierPath.maxScale || 1.2;

    const phase1Start = 0;
    const phase2Start = phase1Start + PHASE1_DURATION;
    const phase3Start = phase2Start + PHASE2_DURATION;
    const phase4Start = phase3Start + PHASE3_DURATION;

    let scale = 0;
    let opacity = 0;

    if (elapsed < 0 || elapsed >= durationSec) {
      scale = 0;
      opacity = 0;
    } else if (elapsed < phase2Start) {
      const phase1Progress = Math.min(
        1,
        Math.max(0, elapsed / PHASE1_DURATION)
      );
      scale = 0 + (maxScale - 0) * phase1Progress;
      opacity = 0 + (1 - 0) * phase1Progress;
    } else if (elapsed < phase3Start) {
      const phase2Progress = Math.min(
        1,
        Math.max(0, (elapsed - phase2Start) / PHASE2_DURATION)
      );
      scale = maxScale + (1 - maxScale) * phase2Progress;
      opacity = 1;
    } else if (elapsed < phase4Start) {
      scale = 1;
      opacity = 1;
    } else if (elapsed < phase4Start + PHASE4_DURATION) {
      const phase4Progress = Math.min(
        1,
        Math.max(0, (elapsed - phase4Start) / PHASE4_DURATION)
      );
      scale = 1 + (0 - 1) * phase4Progress;
      opacity = 1 + (0 - 1) * phase4Progress;
    } else {
      scale = 0;
      opacity = 0;
    }

    multiplierEl.style.transform = `translate(-50%, -50%) scale(${scale}) translateZ(0)`;
    multiplierEl.style.opacity = `${opacity}`;
  });
}
