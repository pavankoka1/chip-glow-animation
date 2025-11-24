export class CPUMonitor {
  constructor(sampleSize = 60) {
    this.sampleSize = sampleSize;
    this.frameTimes = [];
    this.frameStartTime = 0;
  }

  startFrame() {
    this.frameStartTime = performance.now();
  }

  endFrame() {
    if (this.frameStartTime === 0) return 0;

    const frameTime = performance.now() - this.frameStartTime;
    this.frameTimes.push(frameTime);

    if (this.frameTimes.length > this.sampleSize) {
      this.frameTimes.shift();
    }

    this.frameStartTime = 0;
    return frameTime;
  }

  getCPUUsage() {
    if (this.frameTimes.length === 0) return 0;

    const avgFrameTime =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const frameBudget = 16.67;
    const cpuUsage = Math.min(100, (avgFrameTime / frameBudget) * 100);

    return Math.round(cpuUsage * 10) / 10;
  }

  getCurrentFrameTime() {
    if (this.frameTimes.length === 0) return 0;
    return Math.round(this.frameTimes[this.frameTimes.length - 1] * 10) / 10;
  }
}

export function drawCPUUsage(ctx, cpuUsage, frameTime, x, y) {
  const padding = 10;
  const fontSize = 14;
  const lineHeight = fontSize + 4;

  ctx.save();
  ctx.font = `${fontSize}px monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";

  const cpuText = `CPU: ${cpuUsage.toFixed(1)}%`;
  const frameText = `Frame: ${frameTime.toFixed(2)}ms`;

  const cpuMetrics = ctx.measureText(cpuText);
  const frameMetrics = ctx.measureText(frameText);
  const maxWidth = Math.max(cpuMetrics.width, frameMetrics.width);

  const bgX = x - maxWidth - padding * 2;
  const bgY = y;
  const bgWidth = maxWidth + padding * 2;
  const bgHeight = lineHeight * 2 + padding * 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

  ctx.fillStyle =
    cpuUsage > 80 ? "#ff4444" : cpuUsage > 50 ? "#ffaa00" : "#44ff44";
  ctx.fillText(cpuText, x - padding, y + padding);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(frameText, x - padding, y + padding + lineHeight);

  ctx.restore();
}
