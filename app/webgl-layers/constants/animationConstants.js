/**
 * Animation timing constants for WebGL layers
 * These constants help ensure animations work correctly across different FPS rates,
 * including high refresh rate displays (120Hz, 144Hz) on Mac
 */

// Maximum delta time per frame (50ms = 20 FPS minimum)
// This prevents large jumps when the tab is inactive or system is slow
export const MAX_DT_SEC = 0.05;

// Minimum delta time per frame (1ms = 1000 FPS maximum theoretical)
// This prevents division by zero and precision issues on very high FPS displays
export const MIN_DT_SEC = 0.001;

// Expected FPS constants
export const DEFAULT_FPS = 60;
export const MIN_FPS = 30;
export const MAX_FPS = 240; // Support for high refresh rate displays (120Hz, 144Hz, 240Hz)

// Minimum duration to prevent division by zero
export const MIN_DURATION_MS = 1;

