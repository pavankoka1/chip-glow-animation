import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MAX_BETSPOT_COUNT = 50;
const DEFAULT_BETSPOT_COUNT = 10;

export function useAnimationState(initialConfig) {
  const [config, setConfig] = useState(initialConfig);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const betspotCount = Math.min(
    Math.max(1, config.betspotCount || DEFAULT_BETSPOT_COUNT),
    MAX_BETSPOT_COUNT
  );

  const activeBetspotIndices = useMemo(() => {
    const indices = Array.from({ length: betspotCount }, (_, i) => i);
    const seed = betspotCount * 7919;
    for (let i = indices.length - 1; i > 0; i--) {
      const pseudoRandom = ((seed + i) * 9301 + 49297) % 233280;
      const j = Math.floor((pseudoRandom / 233280) * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [betspotCount]);

  const [anchorEls, setAnchorEls] = useState(() =>
    Array(betspotCount).fill(null)
  );
  const [selectedBetspots, setSelectedBetspots] = useState(() =>
    Array(betspotCount).fill(true)
  );
  const [isPlaying, setIsPlaying] = useState(() =>
    Array(betspotCount).fill(false)
  );

  const isPlayingRef = useRef(isPlaying);
  const selectedBetspotsRef = useRef(selectedBetspots);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    selectedBetspotsRef.current = selectedBetspots;
  }, [selectedBetspots]);

  const handleSelectionChange = useCallback(
    (selection) => {
      setSelectedBetspots(selection);
      const newPlaying = Array(betspotCount).fill(false);
      selection.forEach((selected, index) => {
        if (selected) {
          newPlaying[index] = true;
        }
      });
      setIsPlaying(newPlaying);
    },
    [betspotCount]
  );

  const handlePlayPause = useCallback(() => {
    const allPlaying = isPlaying.every(
      (playing, index) => !selectedBetspots[index] || playing
    );
    if (allPlaying) {
      setIsPlaying((prev) =>
        prev.map((playing, index) =>
          selectedBetspots[index] ? false : playing
        )
      );
    } else {
      setIsPlaying((prev) =>
        prev.map((playing, index) => (selectedBetspots[index] ? true : playing))
      );
    }
  }, [isPlaying, selectedBetspots]);

  const isAnyPlaying = useMemo(() => {
    return isPlaying.some(
      (playing, index) => selectedBetspots[index] && playing
    );
  }, [isPlaying, selectedBetspots]);

  return {
    config,
    setConfig,
    configOpen,
    setConfigOpen,
    selectorOpen,
    setSelectorOpen,
    betspotCount,
    activeBetspotIndices,
    anchorEls,
    setAnchorEls,
    selectedBetspots,
    isPlaying,
    setIsPlaying,
    isPlayingRef,
    selectedBetspotsRef,
    handleSelectionChange,
    handlePlayPause,
    isAnyPlaying,
  };
}
