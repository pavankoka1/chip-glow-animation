# Chip Glow Animation – Architecture and Animation Flow

This project implements a GPU-accelerated “spark line” glow animation using WebGL in a fixed, full-viewport canvas layered under the BetSpot element. The system supports diagonal paths, configurable camera/tilt, depth, glow, and timing, and is designed for precise timing and smooth visual output.

## High-Level Architecture

- `app/components/GlowAnimation.js` – Orchestrates the animation loop using `requestAnimationFrame`, computes per-path progress and completion, and issues draw calls.
- `app/components/animation/Spark.js` – Draw function that sets WebGL program uniforms for one path instance and renders it in a single full-screen pass.
- `app/components/animation/shaders.js` – Vertex and fragment shaders that compute the visible spark segment on a rotated ellipse with perspective/tilt and glow.
- `app/components/animation/constants.js` – Defaults and vertex label map (`TL/TR/BR/BL`).
- `app/hooks/useFps.js` – Measures FPS once after a warm-up period and stores it in sessionStorage.
- `app/components/ConfigModal.js` – Compact configuration modal with Cancel/Submit, provides global and per-path controls.

## Coordinate System and Path

- Screen space: origin at top-left; +X right, +Y down.
- BetSpot center is treated as `(0,0)` conceptually; actual screen center is derived from the anchor element’s bounding box each frame.
- Corners map to screen-space angles:
  - `TL` → -3π/4, `TR` → -π/4, `BR` → +π/4, `BL` → +3π/4.
- The path is an ellipse around the BetSpot center with semi-axes `a` and `b`. The local ellipse is rotated to align the 0-angle direction to the start vertex; an extra per-path `ellipseRotationDeg` can be added for artistic tilt.

## Camera and Depth

- Camera perspective is simulated with `u_cameraDistance`.
- Camera tilt (X/Y) is applied in the shader before projection.
- Depth oscillation is applied as `depthAmplitude * sin(theta + depthPhase)`, then tilted, and projected to screen. By default, `depthAmplitude = 0` to avoid diagonal deviation.

## Animation Timing

- The animation loop uses RAF timestamps to compute `dt` and maintains `accumulatedSec`. This avoids relying on `Date.now()` and keeps motion smooth.
- Per path:
  - `delay` can be specified in ms (values > 20) or seconds (≤ 20).
  - Raw phase `= (time - delay) / duration`, where `duration = animationTimeMs/1000`.
  - The visible segment is a line of fixed pixel length `length` mapped to a phase span `segmentParam = length / pathLengthPx` (computed with the same projection math as the shader).
  - The path runs from `phase=0` to `1`. The **head** can overshoot the end using `overshoot` (default 0.08), and the tail finishes at `1 + segmentParam + overshoot`.
  - A `fadeWindow` (default 0.08) gracefully fades the spark after tail completion.
- The CPU considers the animation complete only when `phase ≥ 1 + segmentParam + overshoot` for all paths, ensuring there is no abrupt cutoff.

## Occlusion (Going Behind the BetSpot)

- The canvas is layered under the BetSpot (`canvas z-index: 0`). This makes the spark naturally appear behind the BetSpot when depth/rotation place it there visually. The BetSpot DOM remains above the canvas by default.

## Glow and Tapering

- The spark line is rendered as a field of small circles along the nearest point to the path segment. The radius tapers toward both ends (max at the middle).
- Glow is implemented as a halo outside the circle: strongest at the circle edge and decaying to ~0 by `radius + glowRadius`.

## Configuration

Global (with per-path overrides where applicable):
- Timing: `animationTimeMs`, `delay`
- Path shape: `ellipse.a`, `ellipse.b`, `ellipseRotationDeg`
- Line: `length`
- Radii: `centerRadius`, `endRadius`
- Glow: `glowRadius`
- Camera: `cameraDistance`
- View tilt: `viewTiltXDeg`, `viewTiltYDeg`
- Depth: `depthAmplitude`, `depthPhaseDeg`
- Flow control: `overshoot`, `fadeWindow`

## Flow – Frame by Frame

1. Compute `dt` from RAF timestamp, accumulate to `timeNowSec`.
2. Acquire BetSpot center from `anchorEl.getBoundingClientRect()`.
3. For each enabled path:
   - Build local geometry (start/end angles, rotation).
   - Recompute path pixel arc length if center/geometry changed.
   - Compute `rawPhase = (timeNowSec - delaySec)/durationSec`.
4. Determine completion when every path’s `rawPhase ≥ 1 + segmentParam + overshoot`.
5. Clear and render spark for each path:
   - Set uniforms (center, time, delay, shape, camera/tilt/depth, overshoot/fade).
   - Shaders compute the nearest point to the current visible segment and draw the spark with glow and taper.
   - If `phase` is in the overshoot range, a fade factor is applied for a graceful end.

## Performance Notes

- FPS is measured once after a warm-up second and stored. The animation loop does not re-render when FPS is updated.
- The path length computation uses 128 samples matching shader projection to maintain CPU/GPU agreement for completion timing.

## Troubleshooting

- Abrupt end: Increase `overshoot` and `fadeWindow` in the global config or per-path.
- Diagonal looks off: Ensure `depthAmplitude=0` and camera tilts are 0 for a pure diagonal. Then introduce depth/tilt as desired.
- Delay: Values > 20 are treated as ms; ≤ 20 as seconds.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
