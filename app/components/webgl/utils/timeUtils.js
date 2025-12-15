/**
 * Time utility functions
 */

/**
 * Converts delay value to seconds
 * Treats values > 20 as milliseconds, otherwise as seconds
 * @param {number} v - Delay value
 * @returns {number} Delay in seconds
 */
export function delayToSeconds(v) {
  if (typeof v !== "number" || isNaN(v)) return 0;
  return v > 20 ? v / 1000 : v; // treat large values as ms
}
