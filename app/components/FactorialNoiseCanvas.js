"use client";

import { useEffect, useRef } from "react";

/**
 * Factorial Noise Canvas Component
 *
 * Generates factorial noise representing different component sources of variation.
 * In molecular biology, factorial noise decomposes total noise into intrinsic and extrinsic factors.
 *
 * Colors:
 * - Lightest: #FFFF00 (yellow)
 * - Darkest: #FFC300 (orange/gold)
 */
export default function FactorialNoiseCanvas({ width = 43, height = 46 }) {
  const canvasRef = useRef(null);

  // Simple hash function for pseudo-random noise
  const hash = (x, y, seed = 0) => {
    let n = x + y * 57 + seed * 131;
    n = (n << 13) ^ n;
    return (
      ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 2147483648.0
    );
  };

  // Smooth interpolation
  const smoothstep = (t) => t * t * (3 - 2 * t);

  // 2D noise function
  const noise2D = (x, y, seed = 0) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const n00 = hash(ix, iy, seed);
    const n10 = hash(ix + 1, iy, seed);
    const n01 = hash(ix, iy + 1, seed);
    const n11 = hash(ix + 1, iy + 1, seed);

    const sx = smoothstep(fx);
    const sy = smoothstep(fy);

    const n0 = n00 * (1 - sx) + n10 * sx;
    const n1 = n01 * (1 - sx) + n11 * sx;

    return n0 * (1 - sy) + n1 * sy;
  };

  // Fractal noise (multiple octaves)
  const fractalNoise = (x, y, octaves = 4, persistence = 0.5, seed = 0) => {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += noise2D(x * frequency, y * frequency, seed + i) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue;
  };

  // Semi-circular/arc-shaped bacteria pattern - creates rounded, chunky bacterial shapes
  const caterpillarBacteriaPattern = (x, y) => {
    let result = 0;

    // Multiple sizes - MORE sizes and MORE density for more bacterial shapes
    const arcRadii = [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 9.0, 11.0]; // More sizes, slightly smaller for more density
    const arcAngles = [
      Math.PI * 0.6,
      Math.PI * 0.7,
      Math.PI * 0.8,
      Math.PI * 0.9,
      Math.PI * 1.0,
      Math.PI * 1.1,
      Math.PI * 0.75,
      Math.PI * 0.85,
    ]; // Arc angles
    const widths = [1.8, 2.2, 2.6, 3.0, 3.4, 3.8, 4.2, 4.6]; // Width (chunkier)
    const segments = [3, 4, 5, 6, 7, 8, 4, 5]; // Number of segments
    const weights = [0.14, 0.14, 0.13, 0.13, 0.12, 0.12, 0.11, 0.11];

    for (let i = 0; i < arcRadii.length; i++) {
      const arcRadius = arcRadii[i];
      const arcAngle = arcAngles[i];
      const width = widths[i];
      const segmentCount = segments[i];
      const cellSize = arcRadius * 2.0; // Smaller cell size = more bacteria per area

      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);

      let minDist = Infinity;
      let bestAngle = 0;
      let bestCenterX = 0;
      let bestCenterY = 0;
      let bestArcStart = 0;

      // Check more neighboring cells for better coverage and more bacteria
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const neighborX = cellX + dx;
          const neighborY = cellY + dy;

          // Get arc center, orientation, and start angle
          const centerX =
            neighborX * cellSize +
            cellSize / 2 +
            hash(neighborX, neighborY, 500 + i * 100) * cellSize * 0.4;
          const centerY =
            neighborY * cellSize +
            cellSize / 2 +
            hash(neighborX, neighborY, 600 + i * 100) * cellSize * 0.4;
          const orientation =
            hash(neighborX, neighborY, 700 + i * 100) * Math.PI * 2; // Random orientation
          const arcStart =
            hash(neighborX, neighborY, 800 + i * 100) * Math.PI * 2; // Random start angle

          // Calculate distance to arc
          const dx2 = x - centerX;
          const dy2 = y - centerY;
          const distFromCenter = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          // Angle from center
          let angleFromCenter = Math.atan2(dy2, dx2) - orientation;
          // Normalize angle
          while (angleFromCenter < 0) angleFromCenter += Math.PI * 2;
          while (angleFromCenter >= Math.PI * 2) angleFromCenter -= Math.PI * 2;

          // Check if angle is within arc range
          const normalizedArcStart = arcStart % (Math.PI * 2);
          const normalizedArcEnd =
            (normalizedArcStart + arcAngle) % (Math.PI * 2);

          let isInArc = false;
          if (normalizedArcEnd > normalizedArcStart) {
            isInArc =
              angleFromCenter >= normalizedArcStart &&
              angleFromCenter <= normalizedArcEnd;
          } else {
            // Arc wraps around
            isInArc =
              angleFromCenter >= normalizedArcStart ||
              angleFromCenter <= normalizedArcEnd;
          }

          let dist;
          if (isInArc) {
            // Point is within arc angle range
            // Distance is radial distance from arc
            dist = Math.abs(distFromCenter - arcRadius);
          } else {
            // Outside arc angle - distance to nearest end point
            const end1X =
              centerX + Math.cos(normalizedArcStart + orientation) * arcRadius;
            const end1Y =
              centerY + Math.sin(normalizedArcStart + orientation) * arcRadius;
            const end2X =
              centerX + Math.cos(normalizedArcEnd + orientation) * arcRadius;
            const end2Y =
              centerY + Math.sin(normalizedArcEnd + orientation) * arcRadius;

            const dist1 = Math.sqrt((x - end1X) ** 2 + (y - end1Y) ** 2);
            const dist2 = Math.sqrt((x - end2X) ** 2 + (y - end2Y) ** 2);
            dist = Math.min(dist1, dist2);
          }

          if (dist < minDist) {
            minDist = dist;
            bestAngle = orientation;
            bestCenterX = centerX;
            bestCenterY = centerY;
            bestArcStart = normalizedArcStart;
          }
        }
      }

      // Create semi-circular/arc-shaped bacteria
      const dx2 = x - bestCenterX;
      const dy2 = y - bestCenterY;
      const distFromCenter = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      let angleFromCenter = Math.atan2(dy2, dx2) - bestAngle;
      while (angleFromCenter < 0) angleFromCenter += Math.PI * 2;
      while (angleFromCenter >= Math.PI * 2) angleFromCenter -= Math.PI * 2;

      const normalizedArcEnd = (bestArcStart + arcAngle) % (Math.PI * 2);
      let isInArc = false;
      if (normalizedArcEnd > bestArcStart) {
        isInArc =
          angleFromCenter >= bestArcStart &&
          angleFromCenter <= normalizedArcEnd;
      } else {
        isInArc =
          angleFromCenter >= bestArcStart ||
          angleFromCenter <= normalizedArcEnd;
      }

      let distToArc = Infinity;
      if (isInArc) {
        // Within arc - distance is radial
        distToArc = Math.abs(distFromCenter - arcRadius);
      } else {
        // Outside arc - distance to nearest end
        const end1X =
          bestCenterX + Math.cos(bestArcStart + bestAngle) * arcRadius;
        const end1Y =
          bestCenterY + Math.sin(bestArcStart + bestAngle) * arcRadius;
        const end2X =
          bestCenterX + Math.cos(normalizedArcEnd + bestAngle) * arcRadius;
        const end2Y =
          bestCenterY + Math.sin(normalizedArcEnd + bestAngle) * arcRadius;

        const dist1 = Math.sqrt((x - end1X) ** 2 + (y - end1Y) ** 2);
        const dist2 = Math.sqrt((x - end2X) ** 2 + (y - end2Y) ** 2);
        distToArc = Math.min(dist1, dist2);
      }

      // Create chunky arc body - make it more visible
      const bodyValue = Math.max(0, 1 - distToArc / (width * 0.6)); // Wider acceptance for more visible bacteria

      // Add segmentation along arc
      const segmentAngle = arcAngle / segmentCount;
      const segmentIndex = Math.floor(
        ((angleFromCenter - bestArcStart + Math.PI * 2) % (Math.PI * 2)) /
          segmentAngle
      );
      const segmentLocalAngle =
        ((angleFromCenter - bestArcStart + Math.PI * 2) % (Math.PI * 2)) %
        segmentAngle;

      // Segmentation lines between segments
      const segLineWidth = segmentAngle * 0.15;
      const isOnSegLine =
        segmentLocalAngle < segLineWidth ||
        segmentLocalAngle > segmentAngle - segLineWidth;
      const segLineValue = isOnSegLine && distToArc < width * 0.7 ? 0.4 : 0;

      // Combine body and segmentation - boost the value for more visibility
      const finalValue = Math.max(bodyValue, segLineValue);

      // Boost the value to make bacteria more prominent
      result += finalValue * weights[i] * 1.2; // 20% boost for more visible bacteria
    }

    return Math.min(1, result);
  };

  // Circular bacteria pattern - creates circular/round bacteria (MORE of them)
  const circularBacteriaPattern = (x, y) => {
    let result = 0;

    // Multiple sizes of circular bacteria - MORE sizes for more bacteria
    const radii = [1.5, 2.5, 3.5, 4.5, 5.5, 6.5]; // More sizes, more bacteria
    const weights = [0.2, 0.2, 0.18, 0.15, 0.14, 0.13];

    for (let i = 0; i < radii.length; i++) {
      const radius = radii[i];
      const cellSize = radius * 2.5; // Smaller cell size = more circular bacteria

      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);

      let minDist = Infinity;

      // Check more neighboring cells for better coverage
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const neighborX = cellX + dx;
          const neighborY = cellY + dy;

          // Get circle center
          const centerX =
            neighborX * cellSize +
            cellSize / 2 +
            hash(neighborX, neighborY, 900 + i * 100) * cellSize * 0.5;
          const centerY =
            neighborY * cellSize +
            cellSize / 2 +
            hash(neighborX, neighborY, 1000 + i * 100) * cellSize * 0.5;

          const dx2 = x - centerX;
          const dy2 = y - centerY;
          const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist < minDist) {
            minDist = dist;
          }
        }
      }

      // Create circular bacteria - make them more visible
      const circleValue = Math.max(0, 1 - minDist / (radius * 1.1)); // Slightly larger acceptance
      result += Math.pow(circleValue, 1.1) * weights[i] * 1.2; // Boost for more visibility
    }

    return Math.min(1, result);
  };

  // Growth pattern - creates spreading, organism-like formations
  const growthPattern = (x, y) => {
    // Create branching, spreading patterns
    const angle = Math.atan2(y, x) * 3;
    const radius = Math.sqrt(x * x + y * y);

    // Multiple growth centers
    const growth1 = fractalNoise(x * 0.8, y * 0.8, 4, 0.6, 800);
    const growth2 = fractalNoise(
      x * 1.2 + Math.sin(angle) * 2,
      y * 1.2 + Math.cos(angle) * 2,
      3,
      0.5,
      900
    );
    const growth3 = fractalNoise(x * 0.6, y * 0.6, 5, 0.55, 1000);

    // Radial spreading pattern
    const radial = Math.sin(radius * 2 + angle) * 0.5 + 0.5;

    // Combine growth patterns
    return growth1 * 0.4 + growth2 * 0.3 + growth3 * 0.2 + radial * 0.1;
  };

  // Lumpy organism pattern - creates bulging, organic structures
  const lumpyPattern = (x, y) => {
    // Create multiple lump centers
    const lump1 = fractalNoise(x * 0.4, y * 0.4, 3, 0.7, 1100);
    const lump2 = fractalNoise(x * 0.6, y * 0.6, 4, 0.65, 1200);
    const lump3 = fractalNoise(x * 0.3, y * 0.3, 2, 0.75, 1300);

    // Create bulging effect
    const bulge = Math.pow(lump1 * lump2, 1.5);
    const spread = lump3 * 0.7;

    return Math.max(bulge, spread);
  };

  // Large complex structures - creates larger dark-rimmed circular objects
  const largeComplexStructures = (x, y) => {
    const cellSize = 7.0;
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);

    // More large structures for better pattern coverage
    const structureSeed = hash(cellX, cellY, 1400);
    const hasStructure = structureSeed > 0.6; // 40% chance for large structures

    if (!hasStructure) return 0;

    const centerX = cellX * cellSize + cellSize / 2;
    const centerY = cellY * cellSize + cellSize / 2;
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

    // Dark rim with complex internal structure
    const outerRadius = cellSize * 0.6;
    const innerRadius = cellSize * 0.3;

    let value = 0;
    if (dist < outerRadius) {
      // Dark rim
      if (dist > innerRadius) {
        const rimDist = (dist - innerRadius) / (outerRadius - innerRadius);
        value = Math.pow(1 - rimDist, 1.5) * 0.9;
      } else {
        // Complex internal structure
        const internal = fractalNoise(x * 2, y * 2, 3, 0.6, 1500);
        value = (0.6 + internal * 0.4) * 0.7;
      }
    }

    return value;
  };

  // Irregular aggregates - creates dense clumpy clusters
  const irregularAggregates = (x, y) => {
    const cellSize = 2.5;
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);

    // More aggregates for better pattern distribution
    const aggregateSeed = hash(cellX, cellY, 1600);
    const hasAggregate = aggregateSeed > 0.25; // 75% chance

    if (!hasAggregate) {
      // Less base texture - we want more distinct patterns
      return fractalNoise(x * 1.8, y * 1.8, 2, 0.4, 1600) * 0.2;
    }

    // Create irregular clumpy shape
    const centerX = cellX * cellSize + cellSize / 2;
    const centerY = cellY * cellSize + cellSize / 2;
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

    // Irregular shape using noise
    const shapeNoise = fractalNoise(x * 3, y * 3, 4, 0.5, 1700);
    const baseDist = dist / (cellSize * 0.7);
    const irregularDist = baseDist + (shapeNoise - 0.5) * 0.4;

    const aggregate = Math.max(0, 1 - irregularDist);
    return Math.pow(aggregate, 1.2) * (0.7 + shapeNoise * 0.3);
  };

  // Branching pattern - creates tree-like, branching structures
  const branchingPattern = (x, y) => {
    // Create multiple branching networks
    const branch1 = fractalNoise(x * 0.5, y * 0.5, 5, 0.6, 1600);
    const branch2 = fractalNoise(x * 0.7, y * 0.7, 4, 0.55, 1700);

    // Create branching effect using angle-based patterns
    const angle = Math.atan2(y, x) * 4;
    const radius = Math.sqrt(x * x + y * y);
    const branchRadial = Math.sin(radius * 3 + angle) * 0.5 + 0.5;

    return branch1 * 0.4 + branch2 * 0.4 + branchRadial * 0.2;
  };

  // Network pattern - creates interconnected organism networks
  const networkPattern = (x, y) => {
    const cellSize = 2.5;
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);

    // Create network nodes
    const node1 = hash(cellX, cellY, 1800);
    const node2 = hash(cellX + 1, cellY, 1800);
    const node3 = hash(cellX, cellY + 1, 1800);

    // Interpolate between nodes to create connections
    const fx = x / cellSize - cellX;
    const fy = y / cellSize - cellY;
    const network =
      node1 * (1 - fx) * (1 - fy) +
      node2 * fx * (1 - fy) +
      node3 * (1 - fx) * fy;

    // Add organic variation
    const organic = fractalNoise(x * 1.5, y * 1.5, 3, 0.5, 1900);

    return network * (0.7 + organic * 0.3);
  };

  // Cluster pattern - creates dense clusters of organisms
  const clusterPattern = (x, y) => {
    // Multiple cluster centers
    const cluster1 = fractalNoise(x * 0.35, y * 0.35, 4, 0.65, 2000);
    const cluster2 = fractalNoise(x * 0.45, y * 0.45, 3, 0.7, 2100);
    const cluster3 = fractalNoise(x * 0.25, y * 0.25, 5, 0.6, 2200);

    // Create dense clustering effect
    const cluster = Math.pow(cluster1 * cluster2, 1.3);
    const spread = cluster3 * 0.8;

    return Math.max(cluster, spread * 0.6);
  };

  // Spore pattern - creates small spore-like formations
  const sporePattern = (x, y) => {
    const cellSize = 1.5;
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);

    // Higher density of spores for better coverage
    const sporeSeed = hash(cellX, cellY, 2300);
    const isSpore = sporeSeed > 0.15; // 85% chance for better coverage

    // Even if not a spore, add some base pattern
    if (!isSpore) {
      const basePattern = fractalNoise(x * 1.2, y * 1.2, 2, 0.4, 2300) * 0.25;
      return basePattern;
    }

    const centerX = cellX * cellSize + cellSize / 2;
    const centerY = cellY * cellSize + cellSize / 2;
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

    const sporeSize = cellSize * 0.6;
    const spore = Math.max(0, 1 - dist / sporeSize);

    return Math.pow(spore, 1.5);
  };

  // Mycelium pattern - creates fungal network-like structures
  const myceliumPattern = (x, y) => {
    // Create web-like network structures
    const mycel1 = fractalNoise(x * 0.8, y * 0.8, 6, 0.55, 2400);
    const mycel2 = fractalNoise(x * 1.1, y * 1.1, 5, 0.6, 2500);

    // Create network connections
    const angle = Math.atan2(y, x) * 5;
    const radius = Math.sqrt(x * x + y * y);
    const network = Math.sin(radius * 4 + angle) * 0.5 + 0.5;

    return mycel1 * 0.5 + mycel2 * 0.3 + network * 0.2;
  };

  // Large bacteria with noise - creates bigger oval/circular bacteria with noise around them
  const largeBacteriaWithNoise = (x, y) => {
    let result = 0;

    // Create a few large bacteria (2-3 per area)
    const cellSize = 8.0; // Larger cell size for fewer, bigger bacteria
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);

    // Check neighboring cells
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const neighborX = cellX + dx;
        const neighborY = cellY + dy;

        // Only create bacteria in some cells (sparse distribution)
        const bacteriaSeed = hash(neighborX, neighborY, 2600);
        if (bacteriaSeed < 0.3) continue; // Only 30% of cells have large bacteria

        // Get bacteria center with some variation
        const centerX =
          neighborX * cellSize +
          cellSize / 2 +
          hash(neighborX, neighborY, 2700) * cellSize * 0.3;
        const centerY =
          neighborY * cellSize +
          cellSize / 2 +
          hash(neighborX, neighborY, 2800) * cellSize * 0.3;

        // Determine if oval or circle, and get dimensions
        const isOval = hash(neighborX, neighborY, 2900) > 0.5;
        const baseRadius = cellSize * 0.35;
        const radiusX = isOval
          ? baseRadius * (0.8 + hash(neighborX, neighborY, 3000) * 0.4)
          : baseRadius;
        const radiusY = isOval
          ? baseRadius * (0.8 + hash(neighborX, neighborY, 3100) * 0.4)
          : baseRadius;
        const rotation = hash(neighborX, neighborY, 3200) * Math.PI * 2;

        // Calculate distance from center (accounting for rotation and oval shape)
        const dx2 = x - centerX;
        const dy2 = y - centerY;

        // Rotate point to bacteria's local coordinate system
        const cosR = Math.cos(-rotation);
        const sinR = Math.sin(-rotation);
        const localX = dx2 * cosR - dy2 * sinR;
        const localY = dx2 * sinR + dy2 * cosR;

        // Calculate normalized distance for oval
        const normalizedDist = Math.sqrt(
          (localX / radiusX) ** 2 + (localY / radiusY) ** 2
        );

        // Core bacteria body - strong signal
        const coreDist = Math.max(0, 1 - normalizedDist);
        const coreValue = Math.pow(coreDist, 0.8);

        // Noise around the bacteria - creates organic, irregular edge
        const noiseScale = 2.5;
        const edgeNoise = fractalNoise(
          x * noiseScale,
          y * noiseScale,
          4,
          0.6,
          3300 + neighborX * 100 + neighborY * 100
        );

        // Apply noise to the edge - creates wavy, organic boundary
        const noiseOffset = (edgeNoise - 0.5) * 0.15; // Noise affects edge by ±15%
        const noisyDist = normalizedDist + noiseOffset;

        // Bacteria with noisy edge
        const noisyCoreDist = Math.max(0, 1 - noisyDist);
        const noisyValue = Math.pow(noisyCoreDist, 0.7);

        // Combine core and noisy edge - prefer noisy edge for organic look
        const bacteriaValue = Math.max(coreValue * 0.6, noisyValue * 0.9);

        // Add some internal texture
        const internalNoise = fractalNoise(
          x * 3,
          y * 3,
          3,
          0.5,
          3400 + neighborX * 100 + neighborY * 100
        );
        const texturedValue = bacteriaValue * (0.85 + internalNoise * 0.15);

        result = Math.max(result, texturedValue);
      }
    }

    return Math.min(1, result);
  };

  // Top left large oval virus - creates a big hollow oval-shaped virus (ring/donut) at the top left
  const topLeftCircleVirus = (x, y) => {
    // Position at top left
    // Normalized coordinates range from 0-12
    const centerX = 2.5; // As requested
    const centerY = 2.5; // Keep same vertical position
    const outerRadiusX = 1.5; // Outer radius X (horizontal)
    const outerRadiusY = 1.2; // Outer radius Y (vertical) - makes it oval
    const innerRadiusX = 1.4; // Inner radius X - creates void/hollow center
    const innerRadiusY = 1.1; // Inner radius Y - creates void/hollow center
    const rotation = Math.PI * 0.15; // Slight rotation for natural look

    // Calculate distance from center (accounting for rotation and oval shape)
    const dx = x - centerX;
    const dy = y - centerY;

    // Rotate point to oval's local coordinate system
    const cosR = Math.cos(-rotation);
    const sinR = Math.sin(-rotation);
    const localX = dx * cosR - dy * sinR;
    const localY = dx * sinR + dy * cosR;

    // Calculate normalized distance for oval
    const normalizedDist = Math.sqrt(
      (localX / outerRadiusX) ** 2 + (localY / outerRadiusY) ** 2
    );
    const normalizedDistInner = Math.sqrt(
      (localX / innerRadiusX) ** 2 + (localY / innerRadiusY) ** 2
    );

    // Only render if within outer radius (with margin for noise) and outside inner void
    if (normalizedDist > 1.4) return 0;
    if (normalizedDistInner < 0.9) return 0; // Void in center - no rendering inside inner radius

    // Create smooth ring shape - single continuous ring, not two circles
    let ringValue = 0;
    if (normalizedDistInner >= 0.9 && normalizedDist <= 1.0) {
      // Within the ring - create smooth gradient from inner to outer edge
      const ringDist =
        (normalizedDist - normalizedDistInner) / (1.0 - normalizedDistInner);
      // Stronger near outer edge, fade toward inner edge for smooth transition
      ringValue = Math.pow(1 - ringDist * 0.3, 1.5); // Smooth fade, stronger at outer edge
    } else if (normalizedDistInner < 0.9) {
      // Inside void - should not reach here due to early return, but just in case
      return 0;
    } else {
      // Outside outer edge - fade out smoothly
      const fadeDist = (normalizedDist - 1.0) / 0.4;
      ringValue = Math.max(0, 1 - fadeDist);
    }

    // Make it strong and clearly visible
    const coreValue = Math.pow(ringValue, 0.5);

    // Add noise around the edge for organic look
    const noiseScale = 2.8;
    const edgeNoise = fractalNoise(
      x * noiseScale,
      y * noiseScale,
      4,
      0.65,
      3600
    );

    // Apply noise to the edge - less noise for clearer visibility
    const noiseOffset = (edgeNoise - 0.5) * 0.12; // Reduced noise for clearer shape
    const noisyRingValue = Math.max(0, Math.min(1, ringValue + noiseOffset));
    const noisyValue = Math.pow(noisyRingValue, 0.5);

    // Combine core and noisy edge - prioritize strong visibility
    const virusValue = Math.max(coreValue, noisyValue * 0.9);

    // Add subtle internal texture/variation - don't reduce visibility too much
    const internalNoise = fractalNoise(x * 3.5, y * 3.5, 3, 0.5, 3700);
    const texturedValue = virusValue * (0.9 + internalNoise * 0.1);

    // Boost the value significantly for clear visibility
    return Math.min(1, texturedValue * 1.3);
  };

  // Right side caterpillar viruses - creates a few caterpillar-shaped viruses on the right at different angles
  const rightSideCaterpillarViruses = (x, y) => {
    let result = 0;

    // Position caterpillars on the right side (x > 8 in normalized 0-12 space)
    // Create 3-4 caterpillars at different positions and angles
    const caterpillars = [
      {
        centerX: 9.5,
        centerY: 3.0,
        arcRadius: 1.8,
        arcAngle: Math.PI * 0.8,
        orientation: Math.PI * 0.3, // Angle of rotation
        arcStart: Math.PI * 0.2,
        width: 0.4,
        segments: 4,
        seed: 3800,
      },
      {
        centerX: 10.0,
        centerY: 6.5,
        arcRadius: 1.6,
        arcAngle: Math.PI * 0.9,
        orientation: Math.PI * 0.7,
        arcStart: Math.PI * 0.4,
        width: 0.35,
        segments: 5,
        seed: 3900,
      },
      {
        centerX: 9.2,
        centerY: 8.5,
        arcRadius: 1.5,
        arcAngle: Math.PI * 0.75,
        orientation: Math.PI * 1.2,
        arcStart: Math.PI * 0.1,
        width: 0.38,
        segments: 4,
        seed: 4000,
      },
      {
        centerX: 10.5,
        centerY: 10.0,
        arcRadius: 1.7,
        arcAngle: Math.PI * 0.85,
        orientation: Math.PI * 0.5,
        arcStart: Math.PI * 0.3,
        width: 0.36,
        segments: 5,
        seed: 4100,
      },
    ];

    for (const cat of caterpillars) {
      // Calculate distance to arc
      const dx2 = x - cat.centerX;
      const dy2 = y - cat.centerY;
      const distFromCenter = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      // Angle from center
      let angleFromCenter = Math.atan2(dy2, dx2) - cat.orientation;
      // Normalize angle
      while (angleFromCenter < 0) angleFromCenter += Math.PI * 2;
      while (angleFromCenter >= Math.PI * 2) angleFromCenter -= Math.PI * 2;

      // Check if angle is within arc range
      const normalizedArcStart = cat.arcStart % (Math.PI * 2);
      const normalizedArcEnd =
        (normalizedArcStart + cat.arcAngle) % (Math.PI * 2);

      let isInArc = false;
      if (normalizedArcEnd > normalizedArcStart) {
        isInArc =
          angleFromCenter >= normalizedArcStart &&
          angleFromCenter <= normalizedArcEnd;
      } else {
        // Arc wraps around
        isInArc =
          angleFromCenter >= normalizedArcStart ||
          angleFromCenter <= normalizedArcEnd;
      }

      let distToArc = Infinity;
      if (isInArc) {
        // Within arc - distance is radial
        distToArc = Math.abs(distFromCenter - cat.arcRadius);
      } else {
        // Outside arc - distance to nearest end
        const end1X =
          cat.centerX +
          Math.cos(normalizedArcStart + cat.orientation) * cat.arcRadius;
        const end1Y =
          cat.centerY +
          Math.sin(normalizedArcStart + cat.orientation) * cat.arcRadius;
        const end2X =
          cat.centerX +
          Math.cos(normalizedArcEnd + cat.orientation) * cat.arcRadius;
        const end2Y =
          cat.centerY +
          Math.sin(normalizedArcEnd + cat.orientation) * cat.arcRadius;

        const dist1 = Math.sqrt((x - end1X) ** 2 + (y - end1Y) ** 2);
        const dist2 = Math.sqrt((x - end2X) ** 2 + (y - end2Y) ** 2);
        distToArc = Math.min(dist1, dist2);
      }

      // Create caterpillar body
      const bodyValue = Math.max(0, 1 - distToArc / (cat.width * 0.6));

      // Add segmentation along arc
      const segmentAngle = cat.arcAngle / cat.segments;
      const segmentLocalAngle =
        ((angleFromCenter - normalizedArcStart + Math.PI * 2) % (Math.PI * 2)) %
        segmentAngle;

      // Segmentation lines between segments
      const segLineWidth = segmentAngle * 0.15;
      const isOnSegLine =
        segmentLocalAngle < segLineWidth ||
        segmentLocalAngle > segmentAngle - segLineWidth;
      const segLineValue = isOnSegLine && distToArc < cat.width * 0.7 ? 0.4 : 0;

      // Combine body and segmentation
      const finalValue = Math.max(bodyValue, segLineValue);

      // Add natural noise around the caterpillar
      const noiseScale = 2.5;
      const edgeNoise = fractalNoise(
        x * noiseScale,
        y * noiseScale,
        4,
        0.6,
        cat.seed
      );

      // Apply noise to the edge for organic look
      const noiseOffset = (edgeNoise - 0.5) * 0.15;
      const noisyDist = distToArc + noiseOffset * cat.width * 0.3;
      const noisyBodyValue = Math.max(0, 1 - noisyDist / (cat.width * 0.6));
      const noisyFinalValue = Math.max(finalValue, noisyBodyValue * 0.9);

      result = Math.max(result, noisyFinalValue);
    }

    return Math.min(1, result);
  };

  // Bottom left caterpillar viruses - creates a few caterpillar-shaped viruses on the bottom left at different angles
  const bottomLeftCaterpillarViruses = (x, y) => {
    let result = 0;

    // Position caterpillars on the bottom left (x < 4 and y > 8 in normalized 0-12 space)
    // Create 3-4 caterpillars at different positions and angles
    const caterpillars = [
      {
        centerX: 1.5,
        centerY: 9.0,
        arcRadius: 1.7,
        arcAngle: Math.PI * 0.85,
        orientation: Math.PI * 1.4, // Angle of rotation
        arcStart: Math.PI * 0.25,
        width: 0.38,
        segments: 5,
        seed: 4200,
      },
      {
        centerX: 2.8,
        centerY: 10.2,
        arcRadius: 1.6,
        arcAngle: Math.PI * 0.8,
        orientation: Math.PI * 1.8,
        arcStart: Math.PI * 0.15,
        width: 0.36,
        segments: 4,
        seed: 4300,
      },
      {
        centerX: 0.8,
        centerY: 11.0,
        arcRadius: 1.5,
        arcAngle: Math.PI * 0.75,
        orientation: Math.PI * 1.6,
        arcStart: Math.PI * 0.3,
        width: 0.4,
        segments: 4,
        seed: 4400,
      },
      {
        centerX: 3.2,
        centerY: 8.5,
        arcRadius: 1.8,
        arcAngle: Math.PI * 0.9,
        orientation: Math.PI * 1.1,
        arcStart: Math.PI * 0.2,
        width: 0.35,
        segments: 5,
        seed: 4500,
      },
    ];

    for (const cat of caterpillars) {
      // Calculate distance to arc
      const dx2 = x - cat.centerX;
      const dy2 = y - cat.centerY;
      const distFromCenter = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      // Angle from center
      let angleFromCenter = Math.atan2(dy2, dx2) - cat.orientation;
      // Normalize angle
      while (angleFromCenter < 0) angleFromCenter += Math.PI * 2;
      while (angleFromCenter >= Math.PI * 2) angleFromCenter -= Math.PI * 2;

      // Check if angle is within arc range
      const normalizedArcStart = cat.arcStart % (Math.PI * 2);
      const normalizedArcEnd =
        (normalizedArcStart + cat.arcAngle) % (Math.PI * 2);

      let isInArc = false;
      if (normalizedArcEnd > normalizedArcStart) {
        isInArc =
          angleFromCenter >= normalizedArcStart &&
          angleFromCenter <= normalizedArcEnd;
      } else {
        // Arc wraps around
        isInArc =
          angleFromCenter >= normalizedArcStart ||
          angleFromCenter <= normalizedArcEnd;
      }

      let distToArc = Infinity;
      if (isInArc) {
        // Within arc - distance is radial
        distToArc = Math.abs(distFromCenter - cat.arcRadius);
      } else {
        // Outside arc - distance to nearest end
        const end1X =
          cat.centerX +
          Math.cos(normalizedArcStart + cat.orientation) * cat.arcRadius;
        const end1Y =
          cat.centerY +
          Math.sin(normalizedArcStart + cat.orientation) * cat.arcRadius;
        const end2X =
          cat.centerX +
          Math.cos(normalizedArcEnd + cat.orientation) * cat.arcRadius;
        const end2Y =
          cat.centerY +
          Math.sin(normalizedArcEnd + cat.orientation) * cat.arcRadius;

        const dist1 = Math.sqrt((x - end1X) ** 2 + (y - end1Y) ** 2);
        const dist2 = Math.sqrt((x - end2X) ** 2 + (y - end2Y) ** 2);
        distToArc = Math.min(dist1, dist2);
      }

      // Create caterpillar body
      const bodyValue = Math.max(0, 1 - distToArc / (cat.width * 0.6));

      // Add segmentation along arc
      const segmentAngle = cat.arcAngle / cat.segments;
      const segmentLocalAngle =
        ((angleFromCenter - normalizedArcStart + Math.PI * 2) % (Math.PI * 2)) %
        segmentAngle;

      // Segmentation lines between segments
      const segLineWidth = segmentAngle * 0.15;
      const isOnSegLine =
        segmentLocalAngle < segLineWidth ||
        segmentLocalAngle > segmentAngle - segLineWidth;
      const segLineValue = isOnSegLine && distToArc < cat.width * 0.7 ? 0.4 : 0;

      // Combine body and segmentation
      const finalValue = Math.max(bodyValue, segLineValue);

      // Add natural noise around the caterpillar
      const noiseScale = 2.5;
      const edgeNoise = fractalNoise(
        x * noiseScale,
        y * noiseScale,
        4,
        0.6,
        cat.seed
      );

      // Apply noise to the edge for organic look
      const noiseOffset = (edgeNoise - 0.5) * 0.15;
      const noisyDist = distToArc + noiseOffset * cat.width * 0.3;
      const noisyBodyValue = Math.max(0, 1 - noisyDist / (cat.width * 0.6));
      const noisyFinalValue = Math.max(finalValue, noisyBodyValue * 0.9);

      result = Math.max(result, noisyFinalValue);
    }

    return Math.min(1, result);
  };

  // Factorial noise: combines multiple independent factors
  // Each factor represents a different source of variation
  const factorialNoise = (x, y) => {
    // Noise frequency for good pattern distribution
    const noiseFreq = 12;

    // Factor 1: Intrinsic noise (high frequency, local variation)
    const intrinsic = fractalNoise(
      x * noiseFreq * 0.3,
      y * noiseFreq * 0.3,
      3,
      0.6,
      100
    );

    // Factor 2: Extrinsic noise (low frequency, global variation)
    const extrinsic = fractalNoise(
      x * noiseFreq * 0.1,
      y * noiseFreq * 0.1,
      2,
      0.7,
      200
    );

    // Factor 3: Spatial correlation (medium frequency)
    const spatial = fractalNoise(
      x * noiseFreq * 0.2,
      y * noiseFreq * 0.2,
      2,
      0.5,
      300
    );

    // Factor 4: Curved caterpillar-shaped bacteria pattern (curved, segmented structures at various angles)
    const caterpillarBacteria = caterpillarBacteriaPattern(
      x * noiseFreq * 0.18,
      y * noiseFreq * 0.18
    );

    // Factor 5: Circular bacteria pattern (small round bacteria)
    const circularBacteria = circularBacteriaPattern(
      x * noiseFreq * 0.22,
      y * noiseFreq * 0.22
    );

    // Factor 6: Large complex structures (dark-rimmed circular objects)
    const largeStructures = largeComplexStructures(
      x * noiseFreq * 0.15,
      y * noiseFreq * 0.15
    );

    // Factor 7: Irregular aggregates (dense clumpy clusters)
    const aggregates = irregularAggregates(
      x * noiseFreq * 0.25,
      y * noiseFreq * 0.25
    );

    // Factor 8: Growth pattern (spreading formations)
    const growth = growthPattern(x * noiseFreq * 0.12, y * noiseFreq * 0.12);

    // Factor 9: Lumpy pattern (clusters)
    const lumpy = lumpyPattern(x * noiseFreq * 0.1, y * noiseFreq * 0.1);

    // Factor 8: Branching pattern (tree-like structures)
    const branching = branchingPattern(
      x * noiseFreq * 0.14,
      y * noiseFreq * 0.14
    );

    // Factor 9: Network pattern (interconnected networks)
    const network = networkPattern(x * noiseFreq * 0.16, y * noiseFreq * 0.16);

    // Factor 10: Cluster pattern (dense clusters)
    const cluster = clusterPattern(x * noiseFreq * 0.11, y * noiseFreq * 0.11);

    // Factor 11: Spore pattern (small spore formations)
    const spore = sporePattern(x * noiseFreq * 0.2, y * noiseFreq * 0.2);

    // Factor 12: Mycelium pattern (fungal network structures)
    const mycelium = myceliumPattern(
      x * noiseFreq * 0.13,
      y * noiseFreq * 0.13
    );

    // Factor 13: Fine detail noise
    const detail = fractalNoise(
      x * noiseFreq * 0.5,
      y * noiseFreq * 0.5,
      2,
      0.4,
      400
    );

    // Factor 14: Large bacteria with noise (bigger oval/circular bacteria)
    const largeBacteria = largeBacteriaWithNoise(
      x * noiseFreq * 0.12,
      y * noiseFreq * 0.12
    );

    // Factor 15: Top left large oval virus
    const topLeftVirus = topLeftCircleVirus(x, y);

    // Factor 16: Right side caterpillar viruses
    const rightCaterpillars = rightSideCaterpillarViruses(x, y);

    // Factor 17: Bottom left caterpillar viruses
    const bottomLeftCaterpillars = bottomLeftCaterpillarViruses(x, y);

    // Combine factors - adjust weights for better pattern
    const combined =
      intrinsic * 0.01 +
      extrinsic * 0.01 +
      spatial * 0.01 +
      caterpillarBacteria * 0.38 + // Caterpillar bacteria
      circularBacteria * 0.18 + // Circular bacteria
      largeBacteria * 0.13 + // Large bacteria with noise
      topLeftVirus * 0.2 + // Top left oval virus - increased weight for clear visibility
      rightCaterpillars * 0.15 + // Right side caterpillar viruses
      bottomLeftCaterpillars * 0.15 + // Bottom left caterpillar viruses
      largeStructures * 0.04 + // Large structures
      aggregates * 0.04 + // Aggregates
      growth * 0.01 +
      lumpy * 0.01 +
      branching * 0.0 +
      network * 0.0 +
      cluster * 0.0 +
      spore * 0.0 +
      mycelium * 0.0 +
      detail * 0.0;

    // Normalize to 0-1 range
    // combined is typically between -1 and 1, so (combined + 1) / 2 gives 0-1
    let normalized = (combined + 1) / 2;
    normalized = Math.max(0, Math.min(1, normalized));

    // Use power curve to enhance contrast - higher power for more selective patterns
    // Higher power means only strong patterns will be above threshold
    const result = Math.pow(normalized, 0.8);

    // Ensure we're returning a valid value
    if (isNaN(result) || result < 0 || result > 1) {
      return 0.3; // Fallback to low value (background)
    }

    return result;
  };

  // Convert hex color to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  // Interpolate between two colors
  const interpolateColor = (color1, color2, t) => {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    if (!c1 || !c2) {
      // Fallback to yellow if parsing fails
      return { r: 255, g: 255, b: 0 };
    }
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return { r, g, b };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const pixelRatio = window.devicePixelRatio || 1;
    const scaledWidth = width * pixelRatio;
    const scaledHeight = height * pixelRatio;

    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const imageData = ctx.createImageData(scaledWidth, scaledHeight);
    const data = imageData.data;

    const lightRgb = hexToRgb("#FFFF00");
    const darkRgb = hexToRgb("#FFA500");

    if (!lightRgb || !darkRgb) return;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = lightRgb.r;
      data[i + 1] = lightRgb.g;
      data[i + 2] = lightRgb.b;
      data[i + 3] = 255;
    }

    const threshold = 0.65;
    const thresholdInverse = 1 - threshold;
    const colorDiffR = darkRgb.r - lightRgb.r;
    const colorDiffG = darkRgb.g - lightRgb.g;
    const colorDiffB = darkRgb.b - lightRgb.b;
    const widthScale = 12 / width;
    const heightScale = 12 / height;

    for (let y = 0; y < scaledHeight; y++) {
      const cssY = y / pixelRatio;
      const normalizedY = cssY * heightScale;
      const yOffset = y * scaledWidth;
      
      for (let x = 0; x < scaledWidth; x++) {
        const cssX = x / pixelRatio;
        const normalizedX = cssX * widthScale;
        const noiseValue = factorialNoise(normalizedX, normalizedY);

        let blendFactor = 0;
        if (noiseValue > threshold) {
          const intensity = (noiseValue - threshold) / thresholdInverse;
          blendFactor = Math.min(1, Math.pow(intensity, 0.6));
        }

        const index = (yOffset + x) * 4;
        data[index] = Math.round(lightRgb.r + colorDiffR * blendFactor);
        data[index + 1] = Math.round(lightRgb.g + colorDiffG * blendFactor);
        data[index + 2] = Math.round(lightRgb.b + colorDiffB * blendFactor);
        data[index + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-none z-20"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        mixBlendMode: "normal",
        opacity: 1.0,
      }}
    />
  );
}
