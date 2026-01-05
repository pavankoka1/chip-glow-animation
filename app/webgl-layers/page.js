"use client";

import { PlayArrow, Settings, Stop } from "@mui/icons-material";
import {
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import BetSpot from "./components/BetSpot";
import BetSpotAnimations from "./components/BetSpotAnimations/BetSpotAnimations";
import BlackHoleWebGL from "./components/BlackHoleWebGL/BlackHoleWebGL";
import FactorialNoiseWebGL from "./components/FactorialNoiseWebGL/FactorialNoiseWebGL";
import MultiplierWebGL from "./components/MultiplierWebGL/MultiplierWebGL";
import { SharedWebGLProvider } from "./components/SharedWebGLContext";
import SvgAnimationWebGL from "./components/SvgAnimationWebGL/SvgAnimationWebGL";
import { DEFAULT_CONFIG } from "./constants/defaultConfig";

const MemoizedSvgAnimationWebGL = memo(SvgAnimationWebGL);
const MemoizedMultiplierWebGL = memo(MultiplierWebGL);
const MemoizedFactorialNoiseWebGL = memo(FactorialNoiseWebGL);
const MemoizedBlackHoleWebGL = memo(BlackHoleWebGL);

export default function WebGLLayersPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const betspotRefs = useRef([]);
  const [anchorEls, setAnchorEls] = useState([]);
  const [config] = useState(DEFAULT_CONFIG);
  const [numBetspots, setNumBetspots] = useState(5);
  const [selectedBetspots, setSelectedBetspots] = useState(
    new Set(Array.from({ length: 5 }, (_, i) => i))
  );
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    setSelectedBetspots((prev) => {
      const newSet = new Set(prev);
      const prevSize = Array.from(prev).length;
      for (let i = numBetspots; i < prevSize; i++) {
        newSet.delete(i);
      }
      for (let i = prevSize; i < numBetspots; i++) {
        newSet.add(i);
      }
      return newSet;
    });
  }, [numBetspots]);

  const refCallbacks = useMemo(() => {
    const callbacks = {};
    for (let i = 0; i < numBetspots; i++) {
      callbacks[i] = (el) => {
        const currentEl = betspotRefs.current[i];
        if (currentEl === el) {
          return;
        }

        betspotRefs.current[i] = el;

        setAnchorEls((prev) => {
          if (prev[i] === el) {
            return prev;
          }

          const newEls = [...prev];
          while (newEls.length <= i) {
            newEls.push(null);
          }
          newEls[i] = el;
          return newEls;
        });
      };
    }
    return callbacks;
  }, [numBetspots]);

  const anchorElsWithDelays = useMemo(() => {
    const result = anchorEls
      .map((el, index) => ({ element: el, index }))
      .filter(({ element, index }) => element && selectedBetspots.has(index))
      .map(({ element }) => ({
        element,
        delay: 0,
      }));

    return result;
  }, [anchorEls, selectedBetspots]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const totalAnimationDurationMs = useMemo(() => {
    if (!config.paths) return 0;

    return Math.max(
      ...config.paths
        .filter((p) => p.enabled !== false)
        .map((p) => {
          const delay = p.delay || 0;
          let duration = 0;

          if (p.type === "black-hole") {
            duration = (p.phase1TimeMs || 280) + (p.phase2TimeMs || 50);
          } else {
            duration = p.animationTimeMs || 0;
          }

          return delay + duration;
        }),
      0
    );
  }, [config]);

  useEffect(() => {
    if (!isPlaying || totalAnimationDurationMs === 0) return;

    const timeoutId = setTimeout(() => {
      setIsPlaying(false);
    }, totalAnimationDurationMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isPlaying, totalAnimationDurationMs]);

  return (
    <SharedWebGLProvider>
      <div className="flex min-h-screen w-full items-center justify-center bg-black overflow-hidden relative">
        <div
          className="flex items-center justify-center"
          style={{
            gap: "20px",
          }}
        >
          {Array.from({ length: numBetspots }).map((_, index) => {
            const betspotId = `betspot-${index}`;
            const currentAnchorEl = anchorEls[index];
            const svgPaths =
              config.paths?.filter(
                (p) => p.type === "svg" && p.enabled !== false
              ) || [];
            const multiplierPaths =
              config.paths?.filter(
                (p) => p.type === "multiplier" && p.enabled !== false
              ) || [];
            const factorialNoisePaths =
              config.paths?.filter(
                (p) => p.type === "factorial-noise" && p.enabled !== false
              ) || [];
            const blackHolePaths =
              config.paths?.filter(
                (p) => p.type === "black-hole" && p.enabled !== false
              ) || [];

            return (
              <div
                key={betspotId}
                className="relative flex items-center justify-center"
                style={{
                  overflow: "visible",
                }}
              >
                <div
                  className="relative inline-block"
                  style={{ position: "relative" }}
                >
                  <BetSpot ref={refCallbacks[index]} />

                  {currentAnchorEl && selectedBetspots.has(index) && (
                    <>
                      {factorialNoisePaths.map((pathConfig) => (
                        <MemoizedFactorialNoiseWebGL
                          key={`factorial-${index}-${pathConfig.id}`}
                          anchorEl={currentAnchorEl}
                          pathConfig={pathConfig}
                          isPlaying={isPlaying}
                          globalConfig={config}
                        />
                      ))}

                      {blackHolePaths.map((pathConfig) => (
                        <MemoizedBlackHoleWebGL
                          key={`blackhole-${index}-${pathConfig.id}`}
                          anchorEl={currentAnchorEl}
                          pathConfig={pathConfig}
                          isPlaying={isPlaying}
                          globalConfig={config}
                        />
                      ))}

                      {svgPaths.map((pathConfig) => (
                        <MemoizedSvgAnimationWebGL
                          key={`svg-${index}-${pathConfig.id}`}
                          anchorEl={currentAnchorEl}
                          pathConfig={pathConfig}
                          isPlaying={isPlaying}
                          globalConfig={config}
                        />
                      ))}

                      {multiplierPaths.map((pathConfig) => (
                        <MemoizedMultiplierWebGL
                          key={`multiplier-${index}-${pathConfig.id}`}
                          anchorEl={currentAnchorEl}
                          pathConfig={pathConfig}
                          isPlaying={isPlaying}
                          globalConfig={config}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <BetSpotAnimations
          anchorEl={anchorEls[0]}
          anchorEls={anchorElsWithDelays}
          config={config}
          isPlaying={isPlaying}
          renderOnly={["circle-spark", "spark-spin"]}
        />

        {showConfig && (
          <Paper
            sx={{
              position: "fixed",
              top: 16,
              left: 16,
              zIndex: 1001,
              p: 2,
              bgcolor: "rgba(0, 0, 0, 0.9)",
              color: "#FFD700",
              border: "2px solid #FFD700",
              minWidth: 280,
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <Typography
              variant="h6"
              sx={{ color: "#FFD700", mb: 2, fontSize: "1rem" }}
            >
              Betspot Config
            </Typography>

            <TextField
              label="Number of Betspots"
              type="number"
              value={numBetspots}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10);
                if (value >= 1 && value <= 20) {
                  setNumBetspots(value);
                }
              }}
              slotProps={{
                htmlInput: { min: 1, max: 20 },
              }}
              size="small"
              sx={{
                mb: 2,
                width: "100%",
                "& .MuiOutlinedInput-root": {
                  color: "#FFD700",
                  "& fieldset": {
                    borderColor: "#FFD700",
                  },
                  "&:hover fieldset": {
                    borderColor: "#FFA500",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#FFA500",
                  },
                },
                "& .MuiInputLabel-root": {
                  color: "#FFD700",
                },
              }}
            />

            <Typography
              variant="subtitle2"
              sx={{ color: "#FFD700", mb: 1, fontSize: "0.875rem" }}
            >
              Select Betspots to Animate:
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                maxHeight: "300px",
                overflow: "auto",
              }}
            >
              {Array.from({ length: numBetspots }).map((_, index) => (
                <FormControlLabel
                  key={`betspot-checkbox-${index}`}
                  control={
                    <Checkbox
                      checked={selectedBetspots.has(index)}
                      onChange={(e) => {
                        setSelectedBetspots((prev) => {
                          const newSet = new Set(prev);
                          if (e.target.checked) {
                            newSet.add(index);
                          } else {
                            newSet.delete(index);
                          }
                          return newSet;
                        });
                      }}
                      sx={{
                        color: "#FFD700",
                        "&.Mui-checked": {
                          color: "#FFA500",
                        },
                      }}
                    />
                  }
                  label={`Betspot ${index + 1}`}
                  sx={{
                    color: "#FFD700",
                    "& .MuiFormControlLabel-label": {
                      fontSize: "0.875rem",
                    },
                  }}
                />
              ))}
            </Box>
          </Paper>
        )}

        <IconButton
          onClick={() => setShowConfig((prev) => !prev)}
          sx={{
            position: "fixed",
            top: 16,
            left: showConfig ? 320 : 16,
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
          title={showConfig ? "Hide Config" : "Show Config"}
        >
          <Settings />
        </IconButton>

        <IconButton
          onClick={handlePlayPause}
          sx={{
            position: "fixed",
            top: 16,
            left: showConfig ? 380 : 76,
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
          title={isPlaying ? "Stop Animation" : "Play Animation"}
        >
          {isPlaying ? (
            <Stop />
          ) : (
            <PlayArrow sx={{ transform: "translateX(2px)" }} />
          )}
        </IconButton>
      </div>
    </SharedWebGLProvider>
  );
}
