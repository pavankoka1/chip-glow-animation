"use client";

import { useEffect, useRef } from "react";
import BetSpotSvg from "../BetSpotSvg/BetSpotSvg";

export default function SvgAnimationWebGL({
  anchorEl,
  pathConfig,
  isPlaying = false,
  globalConfig = {},
}) {
  const svgRef = useRef(null);
  const animationIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  const svgMaxScaleReachedRef = useRef(false);
  const svgPreviousScaleRef = useRef(1.0);
  const svgGlowPeakReachedRef = useRef(false);
  const betspotOriginalSizeRef = useRef(null);
  
  // Cache DOM elements and computed values to avoid repeated queries
  const domCacheRef = useRef({
    backgroundGroup: null,
    borderGroup: null,
    multiplierElements: null,
    multiplierElementsCacheTime: 0,
  });
  
  // Cache style values to avoid redundant DOM updates
  const styleCacheRef = useRef({
    svgVisibility: null,
    svgOpacity: null,
    svgTransform: null,
    anchorTransform: null,
    anchorBorderRadius: null,
    anchorBoxShadow: null,
    anchorOverflow: null,
    backgroundOpacity: null,
    borderOpacity: null,
  });

  // Update refs when props change
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      startTimeRef.current = performance.now();
      svgMaxScaleReachedRef.current = false;
      svgPreviousScaleRef.current = 1.0;
      svgGlowPeakReachedRef.current = false;
      betspotOriginalSizeRef.current = null;
    } else {
      startTimeRef.current = null;
      // Reset SVG when stopped
      if (svgRef.current) {
        svgRef.current.style.opacity = "0";
        svgRef.current.style.transform = "scale(1)";
        svgRef.current.style.visibility = "hidden";
      }
      // Reset betspot when stopped
      if (anchorEl) {
        anchorEl.style.transform = "scale(1)";
        anchorEl.style.borderRadius = "";
        anchorEl.style.boxShadow = "";
        anchorEl.style.overflow = "";
      }
    }
  }, [isPlaying, anchorEl]);

  useEffect(() => {
    if (!svgRef.current || !anchorEl) return;

    const svgElement = svgRef.current;
    const domCache = domCacheRef.current;
    const styleCache = styleCacheRef.current;
    
    // Cache DOM elements once
    if (!domCache.backgroundGroup) {
      domCache.backgroundGroup = svgElement.querySelector(
        '[data-svg-part="background"]'
      );
    }
    if (!domCache.borderGroup) {
      domCache.borderGroup = svgElement.querySelector('[data-svg-part="border"]');
    }
    
    const merged = {
      delay: pathConfig.delay || 0,
      animationTimeMs: pathConfig.animationTimeMs || 1000,
      maxScale: pathConfig.maxScale || 1.1,
      glowSpread: pathConfig.glowSpread || 0.12,
    };
    
    // Pre-calculate constants
    const delaySec = merged.delay / 1000;
    const durationSec = merged.animationTimeMs / 1000;
    const maxScaleDiff = merged.maxScale - 1.0;
    const threshold = 1.09;
    const glowColor = "rgba(255, 187, 1, 1)";
    const glowColor2 = "rgba(255, 187, 1, 0.8)";

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // Early exit if not playing
      if (!isPlayingRef.current || !startTimeRef.current) {
        return;
      }

      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000;

      // Early exit if in delay period
      if (elapsed < delaySec) {
        // Only update if values changed
        if (styleCache.svgVisibility !== "hidden") {
          svgElement.style.visibility = "hidden";
          styleCache.svgVisibility = "hidden";
        }
        if (styleCache.svgOpacity !== "0") {
          svgElement.style.opacity = "0";
          styleCache.svgOpacity = "0";
        }
        if (anchorEl) {
          if (styleCache.anchorTransform !== "scale(1) translateZ(0)") {
            anchorEl.style.transform = "scale(1) translateZ(0)";
            styleCache.anchorTransform = "scale(1) translateZ(0)";
          }
          if (styleCache.anchorBorderRadius !== "") {
            anchorEl.style.borderRadius = "";
            styleCache.anchorBorderRadius = "";
          }
          if (styleCache.anchorBoxShadow !== "") {
            anchorEl.style.boxShadow = "";
            styleCache.anchorBoxShadow = "";
          }
          if (styleCache.anchorOverflow !== "") {
            anchorEl.style.overflow = "";
            styleCache.anchorOverflow = "";
          }
        }
        return;
      }

      // Calculate animation elapsed time (after delay)
      const svgElapsed = Math.max(0, elapsed - delaySec);
      const isPastDelay = svgElapsed > 0;

      // Calculate glow scale based on animation progress
      let glowScale = 1.0;
      if (svgElapsed >= 0 && svgElapsed < durationSec) {
        // Scale from 1.0 to maxScale, then back to 1.0
        const progress = svgElapsed / durationSec;
        if (progress < 0.5) {
          // First half: scale up from 1.0 to maxScale
          glowScale = 1.0 + maxScaleDiff * (progress * 2);
        } else {
          // Second half: scale down from maxScale to 1.0
          glowScale = merged.maxScale - maxScaleDiff * ((progress - 0.5) * 2);
        }
      } else if (svgElapsed >= durationSec) {
        // Animation complete: keep at 1.0
        glowScale = 1.0;
      }

      // Track max scale reached
      const threshold = 1.09;
      const previousScale = svgPreviousScaleRef.current;
      const wasMaxReached = svgMaxScaleReachedRef.current;

      if (glowScale >= threshold) {
        svgMaxScaleReachedRef.current = true;
      }

      if (!wasMaxReached && previousScale > 1.05 && glowScale < previousScale) {
        svgMaxScaleReachedRef.current = true;
      }

      svgPreviousScaleRef.current = glowScale;

      // Use cached DOM elements
      const backgroundGroup = domCache.backgroundGroup;
      const borderGroup = domCache.borderGroup;

      // Find multiplier element(s) to get their scale - cache for performance
      // Only re-query every 100ms to avoid expensive DOM traversal every frame
      let multiplierScale = 0;
      const nowMs = performance.now();
      const shouldRefreshMultiplierCache = 
        !domCache.multiplierElements || 
        (nowMs - domCache.multiplierElementsCacheTime) > 100;
      
      if (shouldRefreshMultiplierCache && anchorEl && anchorEl.parentElement) {
        // First, try to find multiplier by data attribute (most reliable)
        let multiplierElements = Array.from(anchorEl.parentElement.children).filter(
          (el) => el.getAttribute('data-multiplier-element') === 'true'
        );

        // Fallback: find by transform and position if data attribute not found
        if (multiplierElements.length === 0) {
          multiplierElements = Array.from(anchorEl.parentElement.children).filter(
            (el) => {
              // Skip the anchorEl itself and SVG elements
              if (el === anchorEl || el.tagName === 'svg' || el.querySelector('svg')) {
                return false;
              }
              
              // Check inline styles first (faster than computed styles)
              const inlineTransform = el.style.transform || '';
              const inlinePosition = el.style.position || '';
              const inlineTop = el.style.top || '';
              const inlineLeft = el.style.left || '';
              
              // Only check computed styles if inline styles are empty
              const transform = inlineTransform || (window.getComputedStyle(el).transform || '');
              const position = inlinePosition || (window.getComputedStyle(el).position || '');
              const top = inlineTop || (window.getComputedStyle(el).top || '');
              const left = inlineLeft || (window.getComputedStyle(el).left || '');
              
              // Multipliers have: translate(-50%, -50%) scale(...) and are positioned at 50%/50%
              // Also check if element contains text content that looks like a multiplier (e.g., "50x")
              const hasMultiplierText = el.textContent && /[\d]+x/i.test(el.textContent);
              
              return (
                transform.includes('scale(') &&
                transform.includes('translate(-50%, -50%)') &&
                (position === 'absolute' || position === '') &&
                (top === '50%' || top === '' || top.includes('50%')) &&
                (left === '50%' || left === '' || left.includes('50%')) &&
                hasMultiplierText
              );
            }
          );
        }

        domCache.multiplierElements = multiplierElements;
        domCache.multiplierElementsCacheTime = nowMs;
      }

      if (domCache.multiplierElements && domCache.multiplierElements.length > 0) {
        // Find the active multiplier (the one that's currently visible/animating)
        // Check all multipliers and use the one with the highest scale (most active)
        let maxScale = 0;
        
        for (const multiplierEl of domCache.multiplierElements) {
          // Prefer inline styles (faster)
          const inlineTransform = multiplierEl.style.transform || '';
          const inlineOpacity = multiplierEl.style.opacity || '';
          const transform = inlineTransform || (window.getComputedStyle(multiplierEl).transform || '');
          const opacity = parseFloat(inlineOpacity || window.getComputedStyle(multiplierEl).opacity) || 0;
          
          // Extract scale from transform
          let scale = 0;
          const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
          if (scaleMatch) {
            scale = parseFloat(scaleMatch[1]) || 0;
          } else {
            // Try to extract scale from matrix transform if scale() is not found
            const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
            if (matrixMatch) {
              const matrixValues = matrixMatch[1].split(',').map(v => parseFloat(v.trim()));
              if (matrixValues.length >= 1) {
                // Matrix scale is typically the first value
                scale = Math.abs(matrixValues[0]) || 0;
              }
            }
          }
          
          // Only consider multipliers that are visible (opacity > 0) and have scale > 0
          // Use the one with the highest scale (most active)
          if (opacity > 0 && scale > 0 && scale > maxScale) {
            maxScale = scale;
          }
        }
        
        multiplierScale = maxScale;
      }

      // Background opacity should sync with multiplier scale:
      // - opacity 0 when multiplier scale is 0
      // - opacity 1 when multiplier scale is 1
      const backgroundOpacity = Math.min(1, Math.max(0, multiplierScale));

      // Apply opacity to background group (only if changed)
      if (backgroundGroup && styleCache.backgroundOpacity !== backgroundOpacity) {
        backgroundGroup.style.opacity = String(backgroundOpacity);
        styleCache.backgroundOpacity = backgroundOpacity;
      }

      // Border always stays at full opacity (only update if changed)
      if (borderGroup && styleCache.borderOpacity !== 1) {
        borderGroup.style.opacity = 1;
        styleCache.borderOpacity = 1;
      }

      // Apply transform to SVG element (only if changed)
      const svgTransform = `scale(${glowScale}) translateZ(0)`;
      if (styleCache.svgTransform !== svgTransform) {
        svgElement.style.transform = svgTransform;
        svgElement.style.transformOrigin = "center center";
        styleCache.svgTransform = svgTransform;
      }

      // Show SVG once animation starts (past delay)
      const isSvgVisible = isPastDelay;
      if (isSvgVisible) {
        if (styleCache.svgVisibility !== "visible") {
          svgElement.style.visibility = "visible";
          styleCache.svgVisibility = "visible";
        }
        if (styleCache.svgOpacity !== "1") {
          svgElement.style.opacity = "1";
          styleCache.svgOpacity = "1";
        }
      }

      // Apply scale and effects to betspot element (in sync with SVG)
      if (anchorEl) {
        // Scale the betspot element (only if changed)
        const anchorTransform = `scale(${glowScale}) translateZ(0)`;
        if (styleCache.anchorTransform !== anchorTransform) {
          anchorEl.style.transform = anchorTransform;
          anchorEl.style.transformOrigin = "center center";
          styleCache.anchorTransform = anchorTransform;
        }

        // Calculate glow intensity for box shadow
        // Use previousScale (captured before update) for peak detection
        const isGoingDown = previousScale > glowScale;
        if ((isGoingDown && previousScale >= 1.05) || glowScale >= 1.1) {
          svgGlowPeakReachedRef.current = true;
        }

        const hasReachedPeak = svgGlowPeakReachedRef.current;
        let glowIntensity = 0;

        if (!hasReachedPeak) {
          glowIntensity =
            glowScale > 1.0 ? Math.min(1, Math.max(0, (glowScale - 1.0) / 0.1)) : 0;
        } else {
          glowIntensity =
            glowScale >= 1.1
              ? 1.0
              : glowScale > 1.0
              ? Math.min(1, Math.max(0, (glowScale - 1.0) / 0.1))
              : 0;
        }

        // Apply box shadow glow effect (only if intensity > 0)
        if (glowIntensity > 0) {
          // Cache original size if not already cached (only calculate once)
          if (!betspotOriginalSizeRef.current) {
            const rect = anchorEl.getBoundingClientRect();
            if (glowScale === 1.0) {
              betspotOriginalSizeRef.current = Math.max(rect.width, rect.height);
            } else {
              betspotOriginalSizeRef.current =
                Math.max(rect.width, rect.height) / glowScale;
            }
          }

          const baseSize = betspotOriginalSizeRef.current;
          const glowSpread = merged.glowSpread || 0.12;

          const baseBlur1 = baseSize * 0.15;
          const baseBlur2 = baseSize * 0.08;
          const spread1 = baseSize * glowSpread;
          const spread2 = baseSize * (glowSpread * 0.5);

          const blur1 = baseBlur1 * glowIntensity * glowScale;
          const blur2 = baseBlur2 * glowIntensity * glowScale;
          const spreadRadius1 = spread1 * glowIntensity * glowScale;
          const spreadRadius2 = spread2 * glowIntensity * glowScale;

          const boxShadow = `0 0 ${blur1}px ${spreadRadius1}px ${glowColor2}, 0 0 ${blur2}px ${spreadRadius2}px ${glowColor}`;
          
          // Only update if changed
          if (styleCache.anchorBoxShadow !== boxShadow) {
            anchorEl.style.boxShadow = boxShadow;
            styleCache.anchorBoxShadow = boxShadow;
          }
          if (styleCache.anchorOverflow !== "visible") {
            anchorEl.style.overflow = "visible";
            styleCache.anchorOverflow = "visible";
          }
        } else {
          // Only update if changed
          if (styleCache.anchorBoxShadow !== "") {
            anchorEl.style.boxShadow = "";
            styleCache.anchorBoxShadow = "";
          }
          if (styleCache.anchorOverflow !== "") {
            anchorEl.style.overflow = "";
            styleCache.anchorOverflow = "";
          }
        }

        // Set border radius when SVG is visible (only if changed)
        const borderRadius = isSvgVisible ? "6.75px" : "";
        if (styleCache.anchorBorderRadius !== borderRadius) {
          anchorEl.style.borderRadius = borderRadius;
          styleCache.anchorBorderRadius = borderRadius;
        }
      }
    };

    animationIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [anchorEl, pathConfig, isPlaying]);

  if (!anchorEl) return null;

  return (
    <BetSpotSvg
      betspotRef={anchorEl}
      svgRef={svgRef}
    />
  );
}

