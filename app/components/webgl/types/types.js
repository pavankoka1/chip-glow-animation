/**
 * Type definitions and interfaces for the WebGL glow animation
 */

/**
 * @typedef {Object} AnimationPath
 * @property {number} id - Unique identifier for the path
 * @property {string} type - Type of animation: 'spark' | 'circle' | 'line' | 'spin' | 'objectGlow' | 'multiplier'
 * @property {string} [startVertex] - Starting vertex: 'TL' | 'TR' | 'BL' | 'BR' | 'L' | 'R' | 'T' | 'B'
 * @property {string} [endVertex] - Ending vertex (for spark paths)
 * @property {number} [animationTimeMs] - Duration in milliseconds
 * @property {number} [delay] - Delay before animation starts (ms)
 * @property {boolean} [enabled] - Whether the path is enabled
 * @property {number} [ellipseTiltDeg] - Ellipse tilt in degrees
 * @property {number} [ellipseRotationDeg] - Ellipse rotation in degrees
 * @property {number} [circleRadius] - Radius for circle animations
 * @property {string} [direction] - Direction: 'clockwise' | 'anticlockwise' | 'auto'
 * @property {number} [startPoint] - Starting point for line animations (degrees)
 * @property {number} [fadeOut] - Fade out duration (ms)
 * @property {number} [fadeIn] - Fade in duration (ms)
 * @property {number} [overshoot] - Overshoot amount
 * @property {number} [fadeWindow] - Fade window size
 * @property {string} [sparkColor] - Spark color (hex)
 * @property {string} [glowColor] - Glow color (hex)
 * @property {number} [glowRadius] - Glow radius
 * @property {number} [headRadius] - Head radius
 * @property {number} [tailRadius] - Tail radius
 * @property {number} [length] - Path length
 * @property {Object} [ellipse] - Ellipse configuration { a: number, b: number }
 * @property {number} [borderWidth] - Border width for spin animation
 * @property {number} [borderRadius] - Border radius for spin animation
 * @property {string} [borderColor] - Border color for spin animation
 * @property {string} [tailColor] - Tail color for spin animation
 * @property {number} [lineWidth] - Line width for spin animation
 * @property {number} [headWidth] - Head width for spin animation
 * @property {number} [tailWidth] - Tail width for spin animation
 * @property {number} [phase1Duration] - Phase 1 duration for multiplier (ms)
 * @property {number} [phase2Duration] - Phase 2 duration for multiplier (ms)
 * @property {number} [phase3Duration] - Phase 3 duration for multiplier (ms)
 * @property {number} [phase4Duration] - Phase 4 duration for multiplier (ms)
 * @property {number} [maxScale] - Maximum scale for multiplier
 * @property {string} [text] - Text for multiplier
 */

/**
 * @typedef {Object} AnimationConfig
 * @property {number} [betspotCount] - Number of betspots
 * @property {number} [animationTimeMs] - Default animation duration (ms)
 * @property {number} [glowRadius] - Default glow radius
 * @property {Object} [ellipse] - Default ellipse configuration
 * @property {number} [headRadius] - Default head radius
 * @property {number} [tailRadius] - Default tail radius
 * @property {number} [length] - Default path length
 * @property {string} [sparkColor] - Default spark color
 * @property {string} [glowColor] - Default glow color
 * @property {AnimationPath[]} [paths] - Array of animation paths
 */

/**
 * @typedef {Object} GlowIntensities
 * @property {number} chipGlowIntensity - Chip glow intensity (0-1)
 * @property {number} perimeterGlowIntensity - Perimeter glow intensity (0-1)
 * @property {number} glowScale - Glow scale factor
 */

/**
 * @typedef {Object} Point
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {number} radius - Point radius
 * @property {number[]} sparkColor - Spark color [r, g, b]
 * @property {number[]} glowColor - Glow color [r, g, b]
 * @property {number} alpha - Alpha value (0-1)
 * @property {number} glowRadius - Glow radius
 */

/**
 * @typedef {Object} PathMetrics
 * @property {number} centerX - Center X coordinate
 * @property {number} centerY - Center Y coordinate
 * @property {number} [pathLength] - Total path length
 * @property {number} [halfWidth] - Half width (for spin)
 * @property {number} [halfHeight] - Half height (for spin)
 * @property {number} [a] - Ellipse parameter a
 * @property {number} [b] - Ellipse parameter b
 * @property {number} [rotAngle] - Rotation angle
 * @property {number} [ellipseTiltDeg] - Ellipse tilt in degrees
 * @property {number} [ellipseRotationDeg] - Ellipse rotation in degrees
 * @property {string} [direction] - Direction
 * @property {string} [startVertex] - Start vertex
 * @property {number} [startPoint] - Start point (for line)
 * @property {number} [circleRadius] - Circle radius
 * @property {boolean} [isCircle] - Whether this is a circle path
 * @property {boolean} [isLine] - Whether this is a line path
 * @property {boolean} [isSpin] - Whether this is a spin path
 * @property {number} [rectWidth] - Rectangle width
 * @property {number} [rectHeight] - Rectangle height
 */

/**
 * @typedef {Object} GlowAnimationWebGLProps
 * @property {HTMLElement} [anchorEl] - Anchor element for positioning
 * @property {AnimationConfig} [config] - Animation configuration
 * @property {boolean} [isPlaying] - Whether animation is playing
 * @property {Function} [onAnimationComplete] - Callback when animation completes
 * @property {Function} [onGlowIntensityChange] - Callback when glow intensity changes
 * @property {Function} [onTimeUpdate] - Callback for time updates
 */

/**
 * @typedef {Object} WebGLBuffers
 * @property {WebGLBuffer} position - Position buffer
 * @property {WebGLBuffer} radius - Radius buffer
 * @property {WebGLBuffer} sparkColor - Spark color buffer
 * @property {WebGLBuffer} glowColor - Glow color buffer
 * @property {WebGLBuffer} alpha - Alpha buffer
 * @property {WebGLBuffer} glowRadius - Glow radius buffer
 */

/**
 * @typedef {Object} WebGLAttribs
 * @property {number} position - Position attribute location
 * @property {number} radius - Radius attribute location
 * @property {number} sparkColor - Spark color attribute location
 * @property {number} glowColor - Glow color attribute location
 * @property {number} alpha - Alpha attribute location
 * @property {number} glowRadius - Glow radius attribute location
 */

/**
 * @typedef {Object} WebGLUniforms
 * @property {WebGLUniformLocation} resolution - Resolution uniform location
 * @property {WebGLUniformLocation} devicePixelRatio - Device pixel ratio uniform location
 */

/**
 * @typedef {Object} ReusableBuffers
 * @property {Float32Array} positions - Position buffer
 * @property {Float32Array} radii - Radius buffer
 * @property {Float32Array} sparkColors - Spark color buffer
 * @property {Float32Array} glowColors - Glow color buffer
 * @property {Float32Array} alphas - Alpha buffer
 * @property {Float32Array} glowRadii - Glow radius buffer
 * @property {number} maxPoints - Maximum number of points
 */

export {};
