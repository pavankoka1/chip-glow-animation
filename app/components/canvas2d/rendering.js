import { hexToRgb } from "./utils";
import { isMobileDevice } from "./mobileOptimization";

export function drawGlowPoint(
  ctx,
  x,
  y,
  radius,
  glowRadius,
  sparkColor,
  glowColor,
  alpha = 1
) {
  const [r, g, b] = hexToRgb(sparkColor);
  const [gr, gg, gb] = hexToRgb(glowColor);
  const isMobile = isMobileDevice();

  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();

  if (glowRadius > 0) {
    const totalRadius = radius + glowRadius;
    const highOpacityZone = 0.2;
    const maxAuraAlpha = 0.3 * alpha;

    const gradient = ctx.createRadialGradient(
      x,
      y,
      radius,
      x,
      y,
      totalRadius
    );

    const numStops = isMobile ? 8 : 16;
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      let auraAlpha;

      if (t <= highOpacityZone) {
        const tInZone = t / highOpacityZone;
        auraAlpha = maxAuraAlpha * (0.85 + 0.15 * (1 - tInZone));
      } else {
        const tInFadeZone = (t - highOpacityZone) / (1 - highOpacityZone);
        const falloff = Math.pow(1 - tInFadeZone, 2.5);
        auraAlpha = maxAuraAlpha * falloff;
      }

      auraAlpha = Math.min(auraAlpha, maxAuraAlpha);
      gradient.addColorStop(t, `rgba(${gr}, ${gg}, ${gb}, ${auraAlpha * 0.5})`);
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, totalRadius, 0, 2 * Math.PI);
    ctx.fill();

    if (!isMobile) {
      const numSparkles = Math.max(4, Math.floor(glowRadius * 1.2));
      const sparkleBaseRadius = Math.max(0.3, glowRadius * 0.08);

      const hash = (n) => {
        const x = Math.sin(n) * 10000;
        return x - Math.floor(x);
      };

      ctx.save();
      for (let i = 0; i < numSparkles; i++) {
        const hashValue = hash(x * 1000 + y * 1000 + i * 100);
        const hashValue2 = hash(x * 2000 + y * 2000 + i * 200);

        const angle = (i / numSparkles) * Math.PI * 2 + (hashValue * 0.3 - 0.15);
        const distanceFromCore = radius + glowRadius * (0.4 + hashValue2 * 0.5);

        const sparkleX = x + Math.cos(angle) * distanceFromCore;
        const sparkleY = y + Math.sin(angle) * distanceFromCore;

        const distanceRatio = (distanceFromCore - radius) / glowRadius;
        let sparkleAlpha;

        if (distanceRatio <= highOpacityZone) {
          sparkleAlpha = maxAuraAlpha;
        } else {
          const tInFadeZone =
            (distanceRatio - highOpacityZone) / (1 - highOpacityZone);
          const falloff = Math.pow(1 - tInFadeZone, 2.5);
          sparkleAlpha = maxAuraAlpha * falloff;
        }

        const sparkleSize = sparkleBaseRadius * (0.8 + hashValue * 0.4);

        const sparkleGradient = ctx.createRadialGradient(
          sparkleX,
          sparkleY,
          0,
          sparkleX,
          sparkleY,
          sparkleSize * 2.5
        );

        sparkleGradient.addColorStop(
          0,
          `rgba(${gr}, ${gg}, ${gb}, ${sparkleAlpha * 0.6})`
        );
        sparkleGradient.addColorStop(
          0.4,
          `rgba(${gr}, ${gg}, ${gb}, ${sparkleAlpha * 0.3})`
        );
        sparkleGradient.addColorStop(1, `rgba(${gr}, ${gg}, ${gb}, 0)`);

        ctx.fillStyle = sparkleGradient;
        ctx.beginPath();
        ctx.arc(sparkleX, sparkleY, sparkleSize * 2.5, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

