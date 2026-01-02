/**
 * Color utility functions
 */

/**
 * Converts hex color to RGB array [0-255, 0-255, 0-255]
 * @param {string} hex - Hex color string (e.g., "#ff0000" or "ff0000")
 * @returns {number[]} RGB array [r, g, b] with values 0-255
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return [255, 255, 255]; // Default to white
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

/**
 * Converts hex color to normalized RGB array [0-1, 0-1, 0-1]
 * @param {string} hex - Hex color string
 * @returns {number[]} Normalized RGB array [r, g, b] with values 0-1
 */
export function hexToRgbNormalized(hex) {
  const rgb = hexToRgb(hex);
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
}

