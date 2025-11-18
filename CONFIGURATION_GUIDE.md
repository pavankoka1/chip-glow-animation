# Configuration Guide

This guide explains where and how to configure the corner deviation and animation timing function.

## Where to Change Configuration

### 1. Global Configuration (Default for all paths)

**File:** `app/components/animation/constants.js`

**Location:** `DEFAULT_CONFIG` object (around line 9)

```javascript
export const DEFAULT_CONFIG = {
  // ... other config ...
  
  // Corner deviation configuration
  cornerDeviation: {
    start: 0.7,        // Start of corner deviation (0.0 to 1.0 = 0% to 100% of path)
    end: 0.9,          // End of corner deviation (0.0 to 1.0 = 0% to 100% of path)
    leftAmount: -25.0, // Left deviation amount in pixels (negative = left)
    rightAmount: 15.0, // Right deviation amount in pixels (positive = right)
  },
  
  // Animation timing function
  timingFunction: "ease-in-out", // Options: "linear", "ease-in", "ease-out", "ease-in-out", "ease"
  
  paths: [
    // ... paths ...
  ],
};
```

### 2. Per-Path Configuration (Override for specific paths)

**File:** `app/page.js` (or wherever you configure paths)

**Location:** In the `config` state or individual path objects

```javascript
const [config, setConfig] = useState({
  // ... global config ...
  
  // Override corner deviation globally
  cornerDeviation: {
    start: 0.65,        // Start at 65% instead of 70%
    end: 0.95,          // End at 95% instead of 90%
    leftAmount: -30.0,  // More left curve
    rightAmount: 20.0,  // More right curve
  },
  
  // Override timing function globally
  timingFunction: "ease-out",
  
  paths: [
    {
      id: 1,
      startVertex: "BR",
      endVertex: "TL",
      delay: 0,
      length: 100,
      enabled: true,
      
      // Override corner deviation for THIS path only
      cornerDeviation: {
        start: 0.6,
        end: 0.85,
        leftAmount: -20.0,
        rightAmount: 10.0,
      },
      
      // Override timing function for THIS path only
      timingFunction: "ease-in",
    },
    {
      id: 2,
      startVertex: "BL",
      endVertex: "TR",
      delay: 300,
      // This path will use global cornerDeviation and timingFunction
    },
  ],
});
```

## Configuration Parameters Explained

### Corner Deviation

- **`start`** (0.0 to 1.0): When the corner deviation begins
  - `0.7` = 70% of the path
  - The spark follows the ellipse normally until this point
  
- **`end`** (0.0 to 1.0): When the corner deviation ends
  - `0.9` = 90% of the path
  - Between `start` and `end`, the spark curves left
  
- **`leftAmount`** (pixels, typically negative): How much the spark curves left
  - Negative values = left curve
  - `-25.0` = 25 pixels to the left
  - Larger absolute values = sharper curve
  
- **`rightAmount`** (pixels, typically positive): How much the spark curves right after the corner
  - Positive values = right curve
  - `15.0` = 15 pixels to the right
  - Applied after `end` point

### Timing Function

Controls how the animation progresses over time:

- **`"linear"`**: Constant speed (no acceleration/deceleration)
- **`"ease-in"`**: Starts slow, speeds up (slow start)
- **`"ease-out"`**: Starts fast, slows down (slow end)
- **`"ease-in-out"`**: Slow start and slow end (smooth)
- **`"ease"`**: Similar to ease-in-out but with different curve

## Examples

### Example 1: Subtle Corner Deviation

```javascript
cornerDeviation: {
  start: 0.75,        // Start later
  end: 0.9,          // End at 90%
  leftAmount: -15.0, // Smaller left curve
  rightAmount: 10.0, // Smaller right curve
},
timingFunction: "ease-in-out",
```

### Example 2: Sharp Corner Deviation

```javascript
cornerDeviation: {
  start: 0.65,        // Start earlier
  end: 0.85,         // End earlier
  leftAmount: -40.0, // Larger left curve
  rightAmount: 25.0, // Larger right curve
},
timingFunction: "ease-out",
```

### Example 3: No Corner Deviation

```javascript
cornerDeviation: {
  start: 1.0,         // Never starts
  end: 1.0,          // Never ends
  leftAmount: 0.0,   // No deviation
  rightAmount: 0.0,  // No deviation
},
```

### Example 4: Different Timing Per Path

```javascript
paths: [
  {
    id: 1,
    startVertex: "BR",
    endVertex: "TL",
    timingFunction: "ease-in",      // Fast start
  },
  {
    id: 2,
    startVertex: "BL",
    endVertex: "TR",
    timingFunction: "ease-out",     // Slow end
  },
],
```

## How It Works

1. **Corner Deviation**: The spark follows the ellipse path normally until `start`. Then it curves left (perpendicular to the path) until `end`, then curves slightly right before continuing.

2. **Timing Function**: Applied to the animation phase, controlling how the spark moves along the path over time. This affects the perceived speed and acceleration.

## Files Modified

- `app/components/animation/constants.js` - Default configuration
- `app/components/animation/shaders.js` - Shader implementation
- `app/components/animation/Spark.js` - Parameter passing
- `app/components/GlowAnimation.js` - Path length calculation

## Testing

After changing configuration:
1. Save the file
2. The animation should automatically update (if hot reload is enabled)
3. Or refresh the page to see changes

