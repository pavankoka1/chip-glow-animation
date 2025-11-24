export function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth <= 768;
}

export function getDevicePixelRatio() {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

export function getMobileSampleCount(baseCount) {
  return isMobileDevice() ? Math.max(Math.floor(baseCount * 0.6), 20) : baseCount;
}

export function getMobileGlowQuality() {
  return isMobileDevice() ? "low" : "high";
}

