# GlowAnimation.js - Complete Step-by-Step Explanation

## Overview
This animation creates a glowing spark effect that travels along an elliptical path around an element (like a betting chip). It uses WebGL for high-performance rendering.

---

## 1. Component Initialization

### Props Received:
- `anchorEl`: DOM element to anchor the animation (e.g., a chip element)
- `config`: Configuration object with paths, timing, visual properties
- `isPlaying`: Boolean to start/stop animation
- `onAnimationComplete`: Callback when animation finishes

### Refs Created:
- `canvasRef`: Reference to the `<canvas>` element
- `glRef`: Reference to the WebGL context
- `positionBufferRef`: Reference to vertex buffer (stores screen quad vertices)
- `pathMetricsRef`: Map storing computed path lengths (cached to avoid recalculation)
- `lastTsRef`: Last timestamp for delta time calculation
- `accumulatedSecRef`: Accumulated time in seconds (for smooth animation)

---

## 2. WebGL Setup (useEffect)

### Step 2.1: Canvas & WebGL Context Creation
```javascript
const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
```
- **`getContext("webgl")`**: Creates a WebGL rendering context
- **`alpha: true`**: Enables transparency
- **`premultipliedAlpha: false`**: Keeps alpha values separate (better for blending)

### Step 2.2: Canvas Resizing
```javascript
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);
```
- **`canvas.width/height`**: Sets canvas pixel dimensions
- **`gl.viewport()`**: Sets the WebGL viewport (where to draw) - matches canvas size

### Step 2.3: Vertex Buffer Creation
```javascript
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...]), gl.STATIC_DRAW);
```
- **`gl.createBuffer()`**: Creates a GPU buffer object
- **`gl.bindBuffer(gl.ARRAY_BUFFER, ...)`**: Binds buffer to ARRAY_BUFFER target (for vertex data)
- **`gl.bufferData()`**: Uploads vertex data to GPU
  - The array contains 6 vertices forming 2 triangles covering the entire screen
  - Format: [x1, y1, x2, y2, x3, y3, x4, y4, x5, y5, x6, y6]
  - This creates a full-screen quad (2 triangles = 1 rectangle)
- **`gl.STATIC_DRAW`**: Hint that data won't change (optimization)

### Step 2.4: Blending Setup
```javascript
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.clearColor(0, 0, 0, 0);
```
- **`gl.enable(gl.BLEND)`**: Enables alpha blending (transparency)
- **`gl.blendFunc()`**: Sets blending formula
  - `SRC_ALPHA`: Uses source alpha (the pixel being drawn)
  - `ONE_MINUS_SRC_ALPHA`: Uses (1 - source alpha) for destination
  - Result: Standard alpha blending (transparent pixels don't overwrite)
- **`gl.clearColor()`**: Sets clear color to transparent black (0,0,0,0)

---

## 3. Animation Loop (`animate` function)

### Step 3.1: Early Exit if Not Playing
```javascript
if (!isPlaying) {
  animationIdRef[0] = null;
  gl.clear(gl.COLOR_BUFFER_BIT);
  return;
}
```
- **`gl.clear(gl.COLOR_BUFFER_BIT)`**: Clears the color buffer (makes canvas transparent)
- Stops animation if `isPlaying` is false

### Step 3.2: Time Calculation
```javascript
const dtSec = Math.min(0.05, (ts - lastTsRef.current) / 1000);
accumulatedSecRef.current += dtSec;
```
- **`dtSec`**: Delta time in seconds (capped at 50ms to prevent large jumps)
- **`accumulatedSecRef`**: Accumulates time for smooth animation (independent of frame rate)

### Step 3.3: Anchor Element Position
```javascript
if (anchorEl?.getBoundingClientRect) {
  rect = anchorEl.getBoundingClientRect();
  centerX = rect.left + rect.width / 2;
  centerY = rect.top + rect.height / 2;
}
```
- Gets the bounding rectangle of the anchor element
- Calculates center point (where the ellipse will be centered)

### Step 3.4: Path Configuration Processing
For each path in the config:
1. **Ellipse Auto-Sizing**:
   ```javascript
   const diagonal = Math.hypot(rect.width, rect.height);
   autoA = 10 + diagonal / 2;
   ```
   - If `ellipse.a` not specified, calculates it based on element size
   - `a` = semi-major axis of ellipse (horizontal radius)
   - `b` = semi-minor axis (vertical radius)

2. **Angle Calculation**:
   ```javascript
   const startDir = getAngleForVertex(p.startVertex); // e.g., "TR" = -π/4
   const endDir = getAngleForVertex(p.endVertex);     // e.g., "BL" = 3π/4
   ```
   - Converts vertex labels (TL, TR, BR, BL) to angles
   - Calculates delta (angular distance) between start and end

3. **Path Length Computation**:
   ```javascript
   const pathLength = computePathLength(...);
   ```
   - Samples the ellipse path 128 times
   - Applies 3D transformations (rotation, tilt, depth)
   - Projects 3D points to 2D screen space
   - Sums distances to get total path length in pixels
   - Cached in `pathMetricsRef` to avoid recalculation

### Step 3.5: Animation Completion Check
```javascript
const scaledPhase = (elapsed / durationSec) * totalSpan;
if (scaledPhase < completeThreshold) {
  allComplete = false;
}
```
- Checks if all paths have finished animating
- `totalSpan = 1.0 + segmentParam + overshoot`
- Animation complete when phase exceeds threshold

### Step 3.6: Rendering Each Path
```javascript
drawSpark({ gl, canvas, anchorCenter, timeNowSec, globalConfig, pathConfig });
```
- Calls `drawSpark` for each active path
- This function sets up WebGL uniforms and draws the spark

---

## 4. WebGL Rendering (`drawSpark` function in Spark.js)

### Step 4.1: Shader Program Setup
```javascript
const { program, attribs, uniforms } = getProgramBundle(gl);
```
- **Shader Program**: Compiled vertex + fragment shaders
- **Attributes**: Per-vertex data (position)
- **Uniforms**: Global values (time, colors, geometry, etc.)

### Step 4.2: Uniform Values
```javascript
gl.uniform2f(u.resolutionLocation, canvas.width, canvas.height);
gl.uniform1f(u.timeLocation, timeNowSec);
gl.uniform1f(u.aLocation, merged.ellipse.a);
// ... many more uniforms
```
- **`gl.uniform*()`**: Sets shader uniform values
- Types: `uniform1f` (float), `uniform2f` (vec2), etc.
- These values are available in both vertex and fragment shaders

### Step 4.3: Vertex Attribute Setup
```javascript
gl.enableVertexAttribArray(attribs.positionLocation);
gl.vertexAttribPointer(attribs.positionLocation, 2, gl.FLOAT, false, 0, 0);
```
- **`gl.enableVertexAttribArray()`**: Enables the position attribute
- **`gl.vertexAttribPointer()`**: Tells WebGL how to read vertex data
  - `2`: 2 components (x, y)
  - `gl.FLOAT`: Data type
  - `false`: Don't normalize
  - `0, 0`: Stride and offset

### Step 4.4: Draw Call
```javascript
gl.drawArrays(gl.TRIANGLES, 0, 6);
```
- **`gl.drawArrays()`**: Executes the draw call
- **`gl.TRIANGLES`**: Draw mode (renders triangles)
- **`0, 6`**: Start at vertex 0, draw 6 vertices (2 triangles = full screen)

---

## 5. Shader Execution

### Vertex Shader (runs once per vertex)
```glsl
void main() {
  v_position = a_position;  // Pass pixel position to fragment shader
  vec2 zeroToOne = a_position / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = vec2(zeroToTwo.x - 1.0, 1.0 - zeroToTwo.y);
  gl_Position = vec4(clipSpace, 0, 1);
}
```
- **Input**: `a_position` (vertex position in pixels)
- **Output**: `gl_Position` (position in clip space, -1 to 1)
- **Transformation**: Converts pixel coordinates to WebGL clip space
  - `zeroToOne`: Normalize to 0-1 range
  - `zeroToTwo`: Scale to 0-2
  - `clipSpace`: Convert to -1 to 1 (flip Y axis)

### Fragment Shader (runs once per pixel)

#### Step 5.1: Time & Phase Calculation
```glsl
float adjustedTime = u_time - u_delay;
float phase = (adjustedTime / u_animationTime) * totalSpan;
```
- Subtracts delay from current time
- Calculates animation phase (0 to totalSpan)

#### Step 5.2: Ellipse Position Calculation
```glsl
vec3 ellipsePositionLocal(float thetaLocal) {
  float x = u_a * cos(thetaLocal);
  float y = u_b * sin(thetaLocal);
  // Apply rotation, tilt, depth...
}
```
- Calculates 3D position on ellipse using parametric equations
- Applies rotations and camera tilts
- Projects to 2D screen space

#### Step 5.3: Visible Segment Calculation
```glsl
float segHead = clamp(phase, 0.0, totalSpan);
float segTail = clamp(phase - segmentParam, 0.0, 1.0);
float thetaHead = mix(thetaStart, thetaEnd, min(segHead, 1.0));
float thetaTail = mix(thetaStart, thetaEnd, segTail);
```
- `segHead`: Where the spark head is (0 to totalSpan)
- `segTail`: Where the spark tail is (head - segmentParam)
- Converts phase to theta angles (ellipse parameter)

#### Step 5.4: Closest Point Finding
```glsl
vec3 findClosestOnSegment(vec2 pixelPos, float theta0, float theta1) {
  // Samples 64 points along segment
  // Returns distance and closest theta
}
```
- For each pixel, finds the closest point on the visible segment
- Uses 64 samples for accuracy

#### Step 5.5: Radius Tapering
```glsl
float distFromCenter = abs(along01 - 0.5) * 2.0;
float radius = mix(u_endRadius, u_centerRadius, 1.0 - smoothDist);
```
- `along01`: Position along segment (0 = tail, 1 = head, 0.5 = middle)
- Radius is largest at middle, tapers to ends

#### Step 5.6: Glow Rendering
```glsl
float coreAlpha = 1.0 - smoothstep(0.0, radius, distPx);
float glowAlpha = (1.0 - smoothstep(radius, radius + u_glowRadius, distPx)) * 0.9;
float totalAlpha = max(coreAlpha, glowAlpha);
```
- **Core**: Solid circle (opacity 1.0 inside radius, 0 outside)
- **Glow**: Halo outside circle (fades from 0.9 to 0 over glowRadius)
- **`smoothstep()`**: Smooth interpolation (creates soft edges)

#### Step 5.7: Fade Out
```glsl
if (phase > maxPhase) {
  float fadeMul = 1.0 - smoothstep(maxPhase, maxPhase + u_fadeWindow, phase);
  totalAlpha *= fadeMul;
}
```
- Fades out during the fade window (after animation completes)

#### Step 5.8: Final Color
```glsl
vec3 gold = vec3(1.0, 0.843, 0.0);
gl_FragColor = vec4(gold, totalAlpha);
```
- Sets pixel color to gold with calculated alpha

---

## 6. Animation Flow Summary

1. **Start**: `isPlaying` becomes true → `requestAnimationFrame` starts loop
2. **Each Frame**:
   - Calculate elapsed time
   - Update path metrics if needed
   - Check completion status
   - For each path: call `drawSpark`
3. **drawSpark**:
   - Sets WebGL uniforms
   - Draws full-screen quad
4. **Fragment Shader** (runs for every pixel):
   - Calculates if pixel is near spark path
   - Computes glow intensity
   - Outputs color/alpha
5. **Result**: Glowing spark traveling along ellipse path

---

## 7. Key WebGL Functions Explained

- **`gl.createBuffer()`**: Allocates GPU memory for data
- **`gl.bindBuffer()`**: Makes a buffer active (WebGL state machine)
- **`gl.bufferData()`**: Uploads data from CPU to GPU
- **`gl.createShader()`**: Creates shader object
- **`gl.shaderSource()`**: Sets shader source code
- **`gl.compileShader()`**: Compiles GLSL code to GPU instructions
- **`gl.createProgram()`**: Creates shader program
- **`gl.attachShader()`**: Attaches shader to program
- **`gl.linkProgram()`**: Links vertex + fragment shaders together
- **`gl.useProgram()`**: Activates a shader program
- **`gl.getUniformLocation()`**: Gets reference to uniform variable
- **`gl.uniform*()`**: Sets uniform value
- **`gl.getAttribLocation()`**: Gets reference to attribute variable
- **`gl.enableVertexAttribArray()`**: Enables attribute
- **`gl.vertexAttribPointer()`**: Describes attribute data layout
- **`gl.drawArrays()`**: Executes draw call (triggers shader execution)
- **`gl.clear()`**: Clears buffers
- **`gl.viewport()`**: Sets drawing area

---

## 8. 3D Projection Math

The animation uses a 3D-to-2D projection:

1. **Ellipse in 2D**: `x = a*cos(θ)`, `y = b*sin(θ)`
2. **Rotation**: Rotate around Z axis
3. **Depth**: Add Z component using `depthAmp * sin(θ + depthPhase)`
4. **Camera Tilt**: Rotate around X, then Y axes
5. **Perspective Projection**: `screen = 3D_xy / (1 + 3D_z / cameraDistance)`

This creates the illusion of depth and perspective.

---

## 9. Performance Optimizations

- **Path Length Caching**: Computed once, reused until geometry changes
- **Shader Program Caching**: Compiled once per WebGL context
- **Full-Screen Quad**: Single draw call renders entire effect
- **GPU Rendering**: All per-pixel calculations run on GPU (parallel)

---

This animation system creates a smooth, performant glow effect by leveraging WebGL's parallel processing capabilities!

