# Spark Animation Point Calculation Analysis

## 1. How Points Are Calculated

### Step-by-Step Process:

1. **Vertex Strings → Angles**

   - `startVertex` and `endVertex` (e.g., "BR", "TL", "L", "R") are converted to angles
   - Function: `getAngleForVertex()` in `app/components/canvas2d/utils.js`
   - Angles are in screen space (y increases downward):
     - BR = +π/4, TL = -3π/4, L = π, R = 0, etc.

2. **Angle → Ellipse Path**

   - Start angle (`startDir`) and end angle (`endDir`) determine the ellipse arc
   - Direction (clockwise/anticlockwise) is calculated from angle delta
   - The ellipse is rotated by `rotAngle = startDir`

3. **Ellipse Parameters**

   - **`a` (semi-major axis)**: Calculated dynamically from BetSpot size
     - `calculateAutoA(rect, 10)` = `(diagonal / 2) + 10`
     - Diagonal = `Math.hypot(rect.width, rect.height)`
     - **This scales with BetSpot size!** ✓
   - **`b` (semi-minor axis)**: From config (default: 20)
     - Currently fixed, but could be made proportional

4. **Position Calculation**

   - Points along the ellipse are calculated using `getEllipsePosition2D()`
   - Formula: `x = a * cos(θ)`, `y = b * sin(θ)`, then rotated by `rotAngle`
   - Additional transformations: `ellipseTiltDeg` and `ellipseRotationDeg`

5. **Start/End Points**
   - Start point: Position on ellipse at `thetaStart = 0` (rotated by `startDir`)
   - End point: Position on ellipse at `thetaEnd` (calculated from angle delta)
   - The spark travels along the ellipse arc from start to end

## 2. Current BetSpot Size

- **Hardcoded**: `w-[100px] h-[100px]` in `BetSpot.js`
- **Rect dimensions**: Read from `getBoundingClientRect()` at runtime
- **Current diagonal**: ~141.42px (for 100x100)
- **Current `a` value**: ~80.71px (141.42/2 + 10)

## 3. Dynamic Scaling Analysis

### ✅ Already Dynamic:

- `calculateAutoA()` uses `rect.width` and `rect.height` ✓
- `getVertexCoords()` uses `rect.width/2` and `rect.height/2` ✓
- `isPointInsideBetSpot()` uses `rect.width/2` and `rect.height/2` ✓
- Ellipse `a` parameter scales with BetSpot size ✓
- Vertex positions scale with BetSpot size ✓

### ✅ Fixed Issues:

- **Ellipse `b` parameter**: Now calculated dynamically!

  - If `b` is not provided in config, it's calculated as: `b = Math.min(rect.width, rect.height) * 0.2`
  - This maintains a consistent ellipse shape across different BetSpot sizes
  - For a 100x100 BetSpot: `a ≈ 80.71`, `b = 20` (ratio ~4:1)
  - For a 200x200 BetSpot: `a ≈ 151.42`, `b = 40` (ratio ~3.8:1) - **maintains similar shape!**

- **Fallback values**: Use 50 (half of 100) when `rect` is null
  - These are fine as fallbacks, but ensure `rect` is always passed

## 4. Implementation Details

### Dynamic `b` Calculation:

- **Location**: `app/components/canvas2d/animations/spark.js` and `app/components/webgl/GlowAnimationWebGL.js`
- **Logic**:
  ```javascript
  if (bVal === undefined || bVal === null) {
    if (rect) {
      const minDimension = Math.min(rect.width, rect.height);
      bVal = minDimension * 0.2;
    } else {
      bVal = autoA * 0.2475; // Fallback: maintains ~4:1 ratio
    }
  }
  ```
- **Result**: Ellipse shape remains consistent across different BetSpot sizes

## 5. Current Behavior When Size Changes

If BetSpot size changes from 100x100 to 200x200:

- ✅ Ellipse `a` scales: 80.71 → 151.42 (proportional)
- ✅ Ellipse `b` scales: 20 → 40 (proportional)
- ✅ Vertex positions scale: corners move proportionally
- ✅ Start/end points scale: move proportionally
- ✅ Ellipse shape maintained: consistent proportions

**Result**: Animation scales perfectly with BetSpot size while maintaining visual consistency!
