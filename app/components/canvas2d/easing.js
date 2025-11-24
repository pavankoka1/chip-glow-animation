export function applyEasingSpark(t) {
  const t1 = 1 - t;
  return 1 - Math.pow(t1, 2.25);
}

export function applyEasingCircle(t) {
  return Math.pow(t, 1.5);
}

export function applyEasingLine(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

