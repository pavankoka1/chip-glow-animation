"use client";

import { PlayArrow, PlaylistPlay, Settings, Stop } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import BetMultiplier from "../components/BetMultiplier";
import BetSpot from "../components/BetSpot";
import BetSpotSelectorModal from "../components/BetSpotSelectorModal";
import BetSpotSvg from "../components/BetSpotSvg";
import Chip from "../components/Chip";
import ConfigModal from "../components/ConfigModal";
import { delayToSeconds } from "../components/canvas2d/utils";
import GlowAnimationWebGL from "../components/webgl/GlowAnimationWebGL";

// Memoize BetSpot - it's now simple and doesn't need prop comparison
const MemoizedBetSpot = memo(BetSpot);
// Don't memoize BetMultiplier - it needs to update every frame for smooth animation
const MemoizedBetMultiplier = BetMultiplier;

const MemoizedGlowAnimationWebGL = memo(
  GlowAnimationWebGL,
  (prevProps, nextProps) => {
    return (
      prevProps.anchorEl === nextProps.anchorEl &&
      prevProps.isPlaying === nextProps.isPlaying &&
      prevProps.config === nextProps.config
    );
  }
);

const MAX_BETSPOT_COUNT = 50;
const DEFAULT_BETSPOT_COUNT = 1;

// Calculate optimal grid layout (rows and columns as equal as possible)
function calculateGridLayout(count) {
  return { cols: 1, rows: 1 };
  if (count <= 0) return { cols: 5, rows: 1 };
  if (count === 1) return { cols: 1, rows: 1 };

  // Find the factor pair closest to a square
  let bestCols = Math.ceil(Math.sqrt(count));
  let bestRows = Math.ceil(count / bestCols);

  // Try to find a better arrangement
  for (let cols = Math.floor(Math.sqrt(count)); cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    if (cols * rows >= count) {
      // Check if this is more square-like
      const aspectRatio = Math.max(cols, rows) / Math.min(cols, rows);
      const bestAspectRatio =
        Math.max(bestCols, bestRows) / Math.min(bestCols, bestRows);
      if (aspectRatio < bestAspectRatio) {
        bestCols = cols;
        bestRows = rows;
      }
    }
  }

  return { cols: bestCols, rows: bestRows };
}

export default function WebGLPage() {
  const [configOpen, setConfigOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [config, setConfig] = useState({
    betspotCount: DEFAULT_BETSPOT_COUNT,
    glowRadius: 5,
    ellipse: { b: 20, a: 76 },
    headRadius: 5,
    tailRadius: 1,
    sparkColor: "#f1eb9d",
    glowColor: "#fdcb3d",
    paths: [
      {
        id: 1,
        type: "spark",
        startVertex: "BR",
        animationTimeMs: 750,
        endVertex: "TL",
        delay: 0,
        ellipseTiltDeg: -45,
        ellipseRotationDeg: -2,
        enabled: true,
      },
      {
        id: 2,
        type: "spark",
        startVertex: "BL",
        endVertex: "TR",
        delay: 170,
        animationTimeMs: 710,
        ellipseTiltDeg: 45,
        ellipseRotationDeg: 2,
        enabled: true,
      },
      {
        id: 7,
        type: "spark",
        startVertex: "L",
        endVertex: "R",
        delay: 380,
        animationTimeMs: 1040,
        enabled: true,
      },
      // {
      //   id: 3,
      //   type: "circle",
      //   animationTimeMs: 1200,
      //   startVertex: "BR",
      //   circleRadius: 25,
      //   delay: 650,
      //   enabled: true,
      //   fadeOut: 400,
      // },
      // {
      //   id: 4,
      //   type: "circle",
      //   animationTimeMs: 1200,
      //   startVertex: "BL",
      //   circleRadius: 25,
      //   delay: 750,
      //   direction: "anticlockwise",
      //   enabled: true,
      //   fadeOut: 400,
      // },
      // {
      //   id: 5,
      //   type: "line",
      //   animationTimeMs: 1000,
      //   startPoint: 315,
      //   lineWidth: 2, // Line thickness
      //   iterations: 1,
      //   glowRadius: 5, // Border glow during line animation
      //   delay: 380,
      //   direction: "clockwise",
      //   sparkColor: "#fdcb3d",
      //   glowColor: "#fdcb3d",
      //   enabled: true,
      //   fadeOut: 400,
      // },
      // {
      //   id: 6,
      //   type: "line",
      //   animationTimeMs: 1000,
      //   startPoint: 135,
      //   lineWidth: 4,
      //   iterations: 1,
      //   glowRadius: 0,
      //   delay: 1000,
      //   direction: "clockwise",
      //   sparkColor: "#fdcb3d",
      //   enabled: true,
      //   fadeOut: 400,
      // },
      {
        id: 8,
        type: "svg",
        delay: 540,
        animationTimeMs: 1000,
        enabled: true,
        maxScale: 1.1, // Same as objectGlow default - scales BetSpot from 1.0 to 1.1
        glowSpread: 0.12, // Spread multiplier for glow effect (default: 0.02 for outer, 0.01 for inner)
      },
      {
        id: 9,
        type: "spin",
        delay: 380,
        animationTimeMs: 14500,
        enabled: true,
        borderRadius: 6.75,
        // borderColor: "#FFE825",
        headColor: "#ffeecc",
        tailColor: "#fcbb60",
        // borderWidth, headWidth, and tailWidth will be calculated dynamically
        // based on BetSpotSvg border width calculation
      },
      {
        id: 10,
        type: "multiplier",
        delay: 780,
        animationTimeMs: 1930, // 130 + 250 + 1250 + 300
        enabled: true,
        phase1Duration: 210,
        phase2Duration: 450,
        phase3Duration: 850,
        phase4Duration: 500,
        maxScale: 1.2,
        text: "50x",
      },
      {
        id: 11,
        type: "multiplier",
        delay: 3510,
        animationTimeMs: 3830, // 130 + 250 + 1250 + 300
        enabled: true,
        phase1Duration: 500,
        phase2Duration: 630,
        phase3Duration: 2200,
        phase4Duration: 500,
        maxScale: 1,
        text: "50x",
      },
      {
        id: 12,
        type: "multiplier",
        delay: 7850,
        animationTimeMs: 4120, // 130 + 250 + 1250 + 300
        enabled: true,
        phase1Duration: 500,
        phase2Duration: 370,
        phase3Duration: 2750,
        phase4Duration: 500,
        maxScale: 1,
        text: "50x",
      },
      {
        id: 13,
        type: "multiplier",
        delay: 12560,
        animationTimeMs: 2300, // 130 + 250 + 1250 + 300
        enabled: true,
        phase1Duration: 500,
        phase2Duration: 150,
        phase3Duration: 1200,
        phase4Duration: 500,
        maxScale: 1,
        text: "50x",
      },
    ],
  });

  const betspotCount = Math.min(
    Math.max(1, config.betspotCount || DEFAULT_BETSPOT_COUNT),
    MAX_BETSPOT_COUNT
  );
  const gridLayout = useMemo(
    () => calculateGridLayout(betspotCount),
    [betspotCount]
  );

  // Select 5 random betspots to have active WebGL animations
  // Use deterministic selection based on betspotCount to avoid Math.random during render
  const activeBetspotIndices = useMemo(() => {
    const indices = Array.from({ length: betspotCount }, (_, i) => i);
    // Deterministic shuffle using betspotCount as seed for consistent results
    // This avoids calling Math.random during render
    const seed = betspotCount * 7919; // Prime number for better distribution
    for (let i = indices.length - 1; i > 0; i--) {
      // Pseudo-random using seed (linear congruential generator)
      const pseudoRandom = ((seed + i) * 9301 + 49297) % 233280;
      const j = Math.floor((pseudoRandom / 233280) * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    // Take first 5 (or all if less than 5)
    return indices.slice(0, Math.min(5, betspotCount));
  }, [betspotCount]);

  // Store refs in a ref object (not accessed during render)
  const betspotRefsStorage = useRef({});
  const svgRefsStorage = useRef({});
  // Track max scale reached for each SVG to determine if opacity should stay at 1
  const svgMaxScaleReachedRef = useRef({});
  // Track previous scale to detect when we cross max threshold
  const svgPreviousScaleRef = useRef({});
  // Track glow peak to control glow intensity fade-out
  const svgGlowPeakReachedRef = useRef({});
  // Store original BetSpot size to avoid recalculating every frame (prevents glitchy glow)
  const betspotOriginalSizeRef = useRef({});
  const [anchorEls, setAnchorEls] = useState(() =>
    Array(betspotCount).fill(null)
  );

  // Batch glow intensity updates to reduce re-render frequency
  const glowIntensityUpdateQueueRef = useRef(new Map());
  const glowIntensityUpdateTimeoutRef = useRef(null);

  // Create stable ref callback factory to prevent infinite loops
  const createAnchorRefCallback = useCallback((index) => {
    return (el) => {
      betspotRefsStorage.current[index] = el;
      // Only update if state doesn't already match - prevents infinite loops
      setAnchorEls((prev) => {
        if (prev[index] === el) {
          return prev; // No change, return same reference
        }
        const newEls = [...prev];
        newEls[index] = el;
        return newEls;
      });
    };
  }, []);

  // Cache ref callbacks to prevent recreation
  const anchorRefCallbacksRef = useRef({});
  const getAnchorRefCallback = useCallback(
    (index) => {
      if (!anchorRefCallbacksRef.current[index]) {
        anchorRefCallbacksRef.current[index] = createAnchorRefCallback(index);
      }
      return anchorRefCallbacksRef.current[index];
    },
    [createAnchorRefCallback]
  );

  // Create SVG ref callback factory
  const createSvgRefCallback = useCallback((index) => {
    return (el) => {
      svgRefsStorage.current[index] = el;
    };
  }, []);

  const svgRefCallbacksRef = useRef({});
  const getSvgRefCallback = useCallback(
    (index) => {
      if (!svgRefCallbacksRef.current[index]) {
        svgRefCallbacksRef.current[index] = createSvgRefCallback(index);
      }
      return svgRefCallbacksRef.current[index];
    },
    [createSvgRefCallback]
  );
  const [selectedBetspots, setSelectedBetspots] = useState(() =>
    Array(betspotCount).fill(true)
  );
  const [isPlaying, setIsPlaying] = useState(() =>
    Array(betspotCount).fill(false)
  );
  // Store isPlaying and selectedBetspots in refs to avoid closure issues in callbacks
  const isPlayingRef = useRef(isPlaying);
  const selectedBetspotsRef = useRef(selectedBetspots);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    selectedBetspotsRef.current = selectedBetspots;
  }, [selectedBetspots]);
  // CRITICAL FIX: Array.fill() with object creates shared reference - use map instead
  const [glowIntensities, setGlowIntensities] = useState(() =>
    Array.from({ length: betspotCount }, () => ({
      chipGlowIntensity: 0,
      perimeterGlowIntensity: 0,
      glowScale: 1,
    }))
  );
  // Multiplier animation refs - store element refs and animation state
  // Support multiple multipliers per betspot (array of refs)
  const multiplierRefs = useRef(Array.from({ length: betspotCount }, () => []));
  // Store current time from main animation loop for each betspot
  const currentTimeSecRefs = useRef(
    Array.from({ length: betspotCount }, () => 0)
  );

  // Helper function to apply glow effects directly to DOM (declared before use)
  // SVG now handles background, border, and glow - only transform/scale needed
  const applyGlowToElement = useCallback(
    (element, intensities, index) => {
      if (!element) return;

      const glowScale = intensities?.glowScale || 1;

      // Apply scale transformation to BetSpot
      element.style.transform = `scale(${glowScale})`;
      element.style.transformOrigin = "center center";

      // Also apply to SVG if it exists (for rAF sync)
      const svgElement = svgRefsStorage.current[index];
      const svgPath = config.paths?.find(
        (p) => p.type === "svg" && p.enabled !== false
      );
      const hasSvgPath = !!svgPath;

      if (svgElement && hasSvgPath) {
        const threshold = 1.09; // Slightly below max (1.1) to account for floating point precision
        const previousScale = svgPreviousScaleRef.current[index] || 1.0;
        const wasMaxReached = svgMaxScaleReachedRef.current[index] || false;

        // Detect when we cross the max scale threshold (reaching or exceeding threshold)
        // Once we've reached max scale, lock opacity at 1 for the rest of the animation
        if (glowScale >= threshold) {
          svgMaxScaleReachedRef.current[index] = true;
        }

        // Detect peak: if we were going up and now going down, we've peaked
        // This catches cases where scale never exactly reaches 1.1 but peaks around 1.099
        if (
          !wasMaxReached &&
          previousScale > 1.05 &&
          glowScale < previousScale
        ) {
          svgMaxScaleReachedRef.current[index] = true;
        }

        // Store current scale for next frame
        svgPreviousScaleRef.current[index] = glowScale;

        // Opacity logic:
        // - First half: opacity goes from 0 to 1 as scale goes from 1.0 to 1.1
        // - Second half: opacity stays at 1 (even as scale goes from 1.1 back to 1.0)
        // Once we've reached max scale, opacity stays at 1 regardless of current scale
        let opacity;
        const isMaxReached = svgMaxScaleReachedRef.current[index];
        if (isMaxReached) {
          // We've reached max scale at some point, opacity stays at 1
          opacity = 1;
        } else {
          // First half: opacity goes from 0 to 1 as scale goes from 1.0 to 1.1
          opacity = Math.min(1, Math.max(0, (glowScale - 1) / 0.1));
        }

        svgElement.style.opacity = opacity;
        svgElement.style.transform = `scale(${glowScale})`;
        svgElement.style.transformOrigin = "center center";
        // Reset visibility when animation starts (opacity > 0)
        if (opacity > 0) {
          svgElement.style.visibility = "visible";
        }

        // Control glow intensity from rAF via BetSpot box-shadow
        // Glow should increase from 0 to 1 as scale goes from 1.0 to 1.1
        // Then decrease from 1 to 0 as scale goes from 1.1 back to 1.0
        let glowIntensity = 0;

        // Initialize glow peak tracking ref if needed
        if (!svgGlowPeakReachedRef.current[index]) {
          svgGlowPeakReachedRef.current[index] = false;
        }

        // Detect if we've reached peak by checking if we're going down from a peak
        // Once we detect we're going down, we know we've peaked
        const isGoingDown = previousScale > glowScale;
        if ((isGoingDown && previousScale >= 1.05) || glowScale >= 1.1) {
          svgGlowPeakReachedRef.current[index] = true;
        }

        const hasReachedPeak = svgGlowPeakReachedRef.current[index];

        // Calculate glow intensity based on scale position
        // First half (1.0 -> 1.1): glow increases from 0 to 1
        // Second half (1.1 -> 1.0): glow decreases from 1 to 0
        if (!hasReachedPeak) {
          // First half: scale is increasing from 1.0 to 1.1
          // Glow increases from 0 to 1 proportionally
          if (glowScale > 1.0) {
            glowIntensity = Math.min(1, Math.max(0, (glowScale - 1.0) / 0.1));
          } else {
            glowIntensity = 0;
          }
        } else {
          // Second half: scale is decreasing from 1.1 to 1.0
          // Glow decreases from 1 to 0 proportionally
          // Formula: (1.1 - glowScale) / 0.1
          // At 1.1: (1.1 - 1.1) / 0.1 = 0.0 (but we want 1.0 at peak)
          // At 1.05: (1.1 - 1.05) / 0.1 = 0.5 ✓
          // At 1.0: (1.1 - 1.0) / 0.1 = 1.0 (but we want 0.0 at end)
          // Correct formula: (glowScale - 1.0) / 0.1 for decreasing phase
          // At 1.1: (1.1 - 1.0) / 0.1 = 1.0 ✓
          // At 1.05: (1.05 - 1.0) / 0.1 = 0.5 ✓
          // At 1.0: (1.0 - 1.0) / 0.1 = 0.0 ✓
          if (glowScale >= 1.1) {
            glowIntensity = 1.0;
          } else if (glowScale > 1.0) {
            // Use same formula as first half: (glowScale - 1.0) / 0.1
            // This gives us 1.0 at 1.1 and 0.0 at 1.0
            glowIntensity = Math.min(1, Math.max(0, (glowScale - 1.0) / 0.1));
          } else {
            glowIntensity = 0;
          }
        }

        // Apply glow to BetSpot using box-shadow
        // Glow color matches original SVG: rgb(255, 187, 1) or similar
        // Using multiple box-shadows to create layered glow effect
        // IMPORTANT: Box-shadow doesn't scale with transform, so we need to scale the blur/spread values
        if (glowIntensity > 0) {
          // Store original size once to avoid recalculating every frame (prevents glitchy glow)
          // BetSpot default size is 100px x 100px
          if (!betspotOriginalSizeRef.current[index]) {
            const rect = element.getBoundingClientRect();
            // Store the original size when scale is 1.0 (or calculate from current if not 1.0)
            if (glowScale === 1.0) {
              betspotOriginalSizeRef.current[index] = Math.max(
                rect.width,
                rect.height
              );
            } else {
              // Calculate original size by dividing by current scale
              betspotOriginalSizeRef.current[index] =
                Math.max(rect.width, rect.height) / glowScale;
            }
          }

          const baseSize = betspotOriginalSizeRef.current[index];

          // Get glowSpread from config, default to 0.02 if not specified
          const glowSpread = svgPath?.glowSpread ?? 0.02;

          // Base blur radius scales with BetSpot size
          const baseBlur1 = baseSize * 0.15;
          const baseBlur2 = baseSize * 0.08;
          // Use glowSpread for outer glow, half of it for inner glow
          const spread1 = baseSize * glowSpread;
          const spread2 = baseSize * (glowSpread * 0.5);

          // Glow color: rgb(255, 187, 1) - matches original SVG glow
          const glowColor = "rgba(255, 187, 1, 1)";
          const glowColor2 = "rgba(255, 187, 1, 0.8)";

          // Scale the blur and spread by both glowIntensity AND glowScale
          // This ensures the glow scales proportionally with the element
          const blur1 = baseBlur1 * glowIntensity * glowScale;
          const blur2 = baseBlur2 * glowIntensity * glowScale;
          const spreadRadius1 = spread1 * glowIntensity * glowScale;
          const spreadRadius2 = spread2 * glowIntensity * glowScale;

          element.style.boxShadow = `
            0 0 ${blur1}px ${spreadRadius1}px ${glowColor2},
            0 0 ${blur2}px ${spreadRadius2}px ${glowColor}
          `;

          // Ensure overflow is visible so glow can extend outside
          element.style.overflow = "visible";
        } else {
          // Remove glow when intensity is 0
          element.style.boxShadow = "";
          element.style.overflow = ""; // Reset overflow
        }

        // Set BetSpot border radius to match SVG (6.75px) when SVG animation is active
        // SVG is active when opacity > 0 (animation has started) or scale !== 1.0
        const isSvgActive = opacity > 0 || glowScale !== 1.0;
        if (isSvgActive) {
          element.style.borderRadius = "6.75px";
        } else {
          // Remove border radius when SVG animation is not active
          element.style.borderRadius = "";
        }
      } else {
        // No SVG path or SVG element - remove border radius and glow
        element.style.borderRadius = "";
        element.style.boxShadow = "";
      }
    },
    [config]
  );

  // Apply initial glow effects and reset when needed (fallback for state-based updates)
  useEffect(() => {
    glowIntensities.forEach((intensity, index) => {
      const element = betspotRefsStorage.current[index];
      if (element) {
        applyGlowToElement(element, intensity, index);
      }
    });
  }, [glowIntensities, applyGlowToElement]);

  // Update arrays when betspot count changes
  const prevBetspotCountRef = useRef(betspotCount);
  useEffect(() => {
    if (prevBetspotCountRef.current === betspotCount) return;
    prevBetspotCountRef.current = betspotCount;

    // Clear cached ref callbacks when betspot count changes
    anchorRefCallbacksRef.current = {};

    setAnchorEls((prev) => {
      const newEls = Array(betspotCount).fill(null);
      for (let i = 0; i < Math.min(prev.length, betspotCount); i++) {
        newEls[i] = prev[i];
      }
      return newEls;
    });
    setSelectedBetspots((prev) => {
      const newSelected = Array(betspotCount).fill(true);
      for (let i = 0; i < Math.min(prev.length, betspotCount); i++) {
        newSelected[i] = prev[i];
      }
      return newSelected;
    });
    setIsPlaying((prev) => {
      const newPlaying = Array(betspotCount).fill(false);
      for (let i = 0; i < Math.min(prev.length, betspotCount); i++) {
        newPlaying[i] = prev[i];
      }
      return newPlaying;
    });
    // Fix: Recreate glowIntensities array with unique objects
    setGlowIntensities((prev) =>
      Array.from({ length: betspotCount }, (_, i) => {
        // Preserve existing values if available
        const existing = prev[i];
        // Reset max scale reached flag and previous scale when betspot count changes
        svgMaxScaleReachedRef.current[i] = false;
        svgPreviousScaleRef.current[i] = 1.0;
        svgGlowPeakReachedRef.current[i] = false;
        delete betspotOriginalSizeRef.current[i];
        return (
          existing || {
            chipGlowIntensity: 0,
            perimeterGlowIntensity: 0,
            glowScale: 1.0,
          }
        );
      })
    );
    // Reset multiplier refs (array for multiple multipliers per betspot)
    multiplierRefs.current = Array.from({ length: betspotCount }, () => []);
    // Reset current time refs
    currentTimeSecRefs.current = Array.from({ length: betspotCount }, () => 0);
  }, [betspotCount]);

  const handleSelectionChange = (selection) => {
    setSelectedBetspots(selection);
    // Reset playing state based on selection
    const newPlaying = Array(betspotCount).fill(false);
    selection.forEach((selected, index) => {
      if (selected) {
        newPlaying[index] = true;
      }
    });
    setIsPlaying(newPlaying);
  };

  const handleAnimationComplete = useCallback((betspotIndex) => {
    // Reset max scale reached flag and previous scale when animation completes
    svgMaxScaleReachedRef.current[betspotIndex] = false;
    svgPreviousScaleRef.current[betspotIndex] = 1.0;
    // Reset glow peak tracking
    svgGlowPeakReachedRef.current[betspotIndex] = false;
    // Clear stored original size (will be recalculated on next animation)
    delete betspotOriginalSizeRef.current[betspotIndex];

    // Remove border radius and glow from BetSpot when animation completes
    const element = betspotRefsStorage.current[betspotIndex];
    if (element) {
      element.style.borderRadius = "";
      element.style.boxShadow = "";
      element.style.overflow = "";
      element.style.transform = "scale(1)"; // Reset transform
    }

    // Hide SVG when animation completes
    const svgElement = svgRefsStorage.current[betspotIndex];
    if (svgElement) {
      svgElement.style.opacity = "0";
      svgElement.style.transform = "scale(1)";
      svgElement.style.visibility = "hidden"; // Hide completely
    }

    // Reset glow intensities in state
    setGlowIntensities((prev) => {
      const newIntensities = [...prev];
      if (newIntensities[betspotIndex]) {
        newIntensities[betspotIndex] = {
          chipGlowIntensity: 0,
          perimeterGlowIntensity: 0,
          glowScale: 1.0,
        };
      }
      return newIntensities;
    });

    // Update isPlaying state - use functional update to ensure we get latest state
    setIsPlaying((prev) => {
      const currentSelected = selectedBetspotsRef.current;

      // Check if this betspot was playing
      if (prev[betspotIndex] === true) {
        const newPlaying = [...prev];
        newPlaying[betspotIndex] = false;
        // Update ref to keep it in sync
        isPlayingRef.current = newPlaying;
        return newPlaying;
      }
      // Return same reference if no change
      return prev;
    });
  }, []);

  // Create memoized handlers for each betspot to prevent infinite loops
  const glowIntensityHandlersRef = useRef({});

  // Batch glow intensity updates to reduce re-render frequency
  const flushGlowIntensityUpdates = useCallback(() => {
    if (glowIntensityUpdateQueueRef.current.size === 0) return;

    setGlowIntensities((prev) => {
      const newIntensities = [...prev];
      let hasChanges = false;

      glowIntensityUpdateQueueRef.current.forEach((intensities, index) => {
        const current = prev[index];
        const chipChanged =
          Math.abs(
            (current?.chipGlowIntensity || 0) - intensities.chipGlowIntensity
          ) > 0.001;
        const perimeterChanged =
          Math.abs(
            (current?.perimeterGlowIntensity || 0) -
              intensities.perimeterGlowIntensity
          ) > 0.001;
        const scaleChanged =
          Math.abs(
            (current?.glowScale || 1.0) - (intensities.glowScale || 1.0)
          ) > 0.001;

        if (chipChanged || perimeterChanged || scaleChanged) {
          newIntensities[index] = intensities;
          hasChanges = true;
        }
      });

      glowIntensityUpdateQueueRef.current.clear();
      return hasChanges ? newIntensities : prev;
    });

    glowIntensityUpdateTimeoutRef.current = null;
  }, []);

  // Process multiplier animations from config using elapsed time (same as other animations)
  const updateMultiplierAnimations = useCallback(
    (index, currentTimeSec) => {
      const multiplierElements = multiplierRefs.current[index];
      if (!multiplierElements || multiplierElements.length === 0) return;

      const cfg = config;
      const multiplierPaths = (cfg.paths || []).filter(
        (p) => p.type === "multiplier" && p.enabled !== false
      );

      multiplierPaths.forEach((multiplierPath, pathIndex) => {
        const multiplierEl = multiplierElements[pathIndex];
        if (!multiplierEl) return;

        // Use same timing system as other animations
        const delayRaw = multiplierPath.delay || 0;
        const delaySec = delayToSeconds(delayRaw);
        const elapsed = Math.max(0, currentTimeSec - delaySec);
        const durationSec = (multiplierPath.animationTimeMs || 1930) / 1000.0;

        // Get phase durations from config or use defaults
        const PHASE1_DURATION = (multiplierPath.phase1Duration || 130) / 1000.0;
        const PHASE2_DURATION = (multiplierPath.phase2Duration || 250) / 1000.0;
        const PHASE3_DURATION =
          (multiplierPath.phase3Duration || 1250) / 1000.0;
        const PHASE4_DURATION = (multiplierPath.phase4Duration || 300) / 1000.0;
        const maxScale = multiplierPath.maxScale || 1.2;

        const phase1Start = 0;
        const phase2Start = phase1Start + PHASE1_DURATION;
        const phase3Start = phase2Start + PHASE2_DURATION;
        const phase4Start = phase3Start + PHASE3_DURATION;
        // Use durationSec from config, but ensure it's at least as long as all phases
        const calculatedTotalDuration = phase4Start + PHASE4_DURATION;
        const totalDuration = Math.max(durationSec, calculatedTotalDuration);

        let scale = 0;
        let opacity = 0;

        if (elapsed < 0 || elapsed >= durationSec) {
          // Before delay or after animation complete
          scale = 0;
          opacity = 0;
        } else if (elapsed < phase2Start) {
          // Phase 1: 0 -> maxScale scale, 0 -> 1 opacity
          const phase1Progress = Math.min(
            1,
            Math.max(0, elapsed / PHASE1_DURATION)
          );
          scale = 0 + (maxScale - 0) * phase1Progress;
          opacity = 0 + (1 - 0) * phase1Progress;
        } else if (elapsed < phase3Start) {
          // Phase 2: maxScale -> 1 scale, opacity 1
          const phase2Progress = Math.min(
            1,
            Math.max(0, (elapsed - phase2Start) / PHASE2_DURATION)
          );
          scale = maxScale + (1 - maxScale) * phase2Progress;
          opacity = 1;
        } else if (elapsed < phase4Start) {
          // Phase 3: scale 1, opacity 1 (hold)
          scale = 1;
          opacity = 1;
        } else if (elapsed < phase4Start + PHASE4_DURATION) {
          // Phase 4: 1 -> 0 scale, 1 -> 0 opacity
          const phase4Progress = Math.min(
            1,
            Math.max(0, (elapsed - phase4Start) / PHASE4_DURATION)
          );
          scale = 1 + (0 - 1) * phase4Progress;
          opacity = 1 + (0 - 1) * phase4Progress;
        } else {
          // After all phases but before durationSec ends - stay at 0
          scale = 0;
          opacity = 0;
        }

        // Update DOM directly for GPU acceleration
        multiplierEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
        multiplierEl.style.opacity = `${opacity}`;
      });
    },
    [config]
  );

  const getGlowIntensityHandler = useCallback(
    (index) => {
      if (!glowIntensityHandlersRef.current[index]) {
        glowIntensityHandlersRef.current[index] = (intensities) => {
          // Apply glow directly to DOM immediately (bypasses React state)
          const element = betspotRefsStorage.current[index];
          if (element) {
            applyGlowToElement(element, intensities, index);
          }

          // Also queue for state update (for tracking purposes)
          glowIntensityUpdateQueueRef.current.set(index, intensities);

          // Batch state updates - flush every 16ms (roughly 60fps)
          if (!glowIntensityUpdateTimeoutRef.current) {
            glowIntensityUpdateTimeoutRef.current = requestAnimationFrame(
              () => {
                flushGlowIntensityUpdates();
              }
            );
          }
        };
      }
      return glowIntensityHandlersRef.current[index];
    },
    [flushGlowIntensityUpdates, applyGlowToElement]
  );

  const handlePlayPause = () => {
    const allPlaying = isPlaying.every(
      (playing, index) => !selectedBetspots[index] || playing
    );
    if (allPlaying) {
      // Stop all selected betspots
      setIsPlaying((prev) =>
        prev.map((playing, index) =>
          selectedBetspots[index] ? false : playing
        )
      );
    } else {
      // Start all selected betspots
      setIsPlaying((prev) =>
        prev.map((playing, index) => (selectedBetspots[index] ? true : playing))
      );
    }
  };

  const isAnyPlaying = useMemo(() => {
    const result = isPlaying.some(
      (playing, index) => selectedBetspots[index] && playing
    );
    return result;
  }, [isPlaying, selectedBetspots]);

  // Reset multiplier animations when animation stops
  useEffect(() => {
    isPlaying.forEach((playing, index) => {
      const shouldAnimate = playing && selectedBetspots[index];
      if (!shouldAnimate) {
        // Reset all multipliers when animation stops
        const multiplierElements = multiplierRefs.current[index];
        if (multiplierElements) {
          multiplierElements.forEach((multiplierEl) => {
            if (multiplierEl) {
              multiplierEl.style.transform = "translate(-50%, -50%) scale(0)";
              multiplierEl.style.opacity = "0";
            }
          });
        }
        // Reset current time
        currentTimeSecRefs.current[index] = 0;

        // Hide SVG when animation stops
        const svgElement = svgRefsStorage.current[index];
        if (svgElement) {
          svgElement.style.opacity = "0";
          svgElement.style.transform = "scale(1)";
          svgElement.style.visibility = "hidden";
        }

        // Reset BetSpot transform and styles
        const element = betspotRefsStorage.current[index];
        if (element) {
          element.style.transform = "scale(1)";
          element.style.borderRadius = "";
          element.style.boxShadow = "";
          element.style.overflow = "";
        }
      }
    });
  }, [isPlaying, selectedBetspots]);

  // Cleanup glow intensity update timeout on unmount
  useEffect(() => {
    return () => {
      if (glowIntensityUpdateTimeoutRef.current) {
        cancelAnimationFrame(glowIntensityUpdateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`,
          gap: "20px",
        }}
      >
        {Array.from({ length: betspotCount }).map((_, index) => (
          <div
            key={index}
            className="relative flex items-center justify-center"
            style={{ overflow: "visible" }}
          >
            <MemoizedBetSpot ref={getAnchorRefCallback(index)} />
            {config.paths?.some(
              (p) => p.type === "svg" && p.enabled !== false
            ) && (
              <BetSpotSvg
                betspotRef={{ current: anchorEls[index] }}
                svgRef={getSvgRefCallback(index)}
              />
            )}
            <Chip />
            {/* Render multiple multipliers based on config */}
            {config.paths
              ?.filter((p) => p.type === "multiplier" && p.enabled !== false)
              .map((multiplierPath, pathIndex) => (
                <MemoizedBetMultiplier
                  key={`multiplier-${index}-${multiplierPath.id || pathIndex}`}
                  text={multiplierPath.text || "50x"}
                  ref={(el) => {
                    if (!multiplierRefs.current[index]) {
                      multiplierRefs.current[index] = [];
                    }
                    multiplierRefs.current[index][pathIndex] = el;
                  }}
                />
              ))}
            {anchorEls[index] && activeBetspotIndices.includes(index) && (
              <MemoizedGlowAnimationWebGL
                key={`glow-${index}-${isPlaying[index]}`}
                anchorEl={anchorEls[index]}
                config={config}
                isPlaying={isPlaying[index] && selectedBetspots[index]}
                onAnimationComplete={() => {
                  handleAnimationComplete(index);
                }}
                onGlowIntensityChange={getGlowIntensityHandler(index)}
                onTimeUpdate={(currentTimeSec) => {
                  currentTimeSecRefs.current[index] = currentTimeSec;
                  updateMultiplierAnimations(index, currentTimeSec);
                }}
              />
            )}
          </div>
        ))}
      </div>

      <IconButton
        onClick={() => setSelectorOpen(true)}
        sx={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1000,
          bgcolor: "rgba(255, 215, 0, 0.1)",
          color: "#FFD700",
          border: "2px solid #FFD700",
          "&:hover": {
            bgcolor: "rgba(255, 215, 0, 0.2)",
            borderColor: "#FFA500",
            color: "#FFA500",
          },
        }}
        title="Select BetSpots"
      >
        <PlaylistPlay />
      </IconButton>

      <IconButton
        onClick={handlePlayPause}
        sx={{
          position: "fixed",
          top: 16,
          left: 80,
          zIndex: 1000,
          bgcolor: "rgba(255, 215, 0, 0.1)",
          color: "#FFD700",
          border: "2px solid #FFD700",
          "&:hover": {
            bgcolor: "rgba(255, 215, 0, 0.2)",
            borderColor: "#FFA500",
            color: "#FFA500",
          },
        }}
        title={isAnyPlaying ? "Stop Animation" : "Play Animation"}
        disabled={false}
      >
        {isAnyPlaying ? (
          <Stop />
        ) : (
          <PlayArrow sx={{ transform: "translateX(2px)" }} />
        )}
      </IconButton>

      <IconButton
        onClick={() => setConfigOpen(true)}
        sx={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1000,
          bgcolor: "rgba(255, 255, 255, 0.1)",
          color: "white",
          "&:hover": {
            bgcolor: "rgba(255, 255, 255, 0.2)",
          },
        }}
      >
        <Settings />
      </IconButton>

      <ConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        config={config}
        onConfigChange={setConfig}
      />

      <BetSpotSelectorModal
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        betspotCount={betspotCount}
        selectedBetspots={selectedBetspots}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
}
