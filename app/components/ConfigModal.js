"use client";

import { Add, Delete, Settings } from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import { VERTEX_LABELS } from "./animation/constants";

export default function ConfigModal({ open, onClose, config, onConfigChange }) {
  const update = (partial) => onConfigChange({ ...config, ...partial });

  // Global handlers
  const handleAnimationTimeChange = (_e, v) => update({ animationTimeMs: v });
  const handleGlowRadiusChange = (_e, v) => update({ glowRadius: v });
  const handleCenterRadiusChange = (_e, v) => update({ centerRadius: v });
  const handleEndRadiusChange = (_e, v) => update({ endRadius: v });
  const handleLengthChange = (_e, v) => update({ length: v });
  const handleEllipseAChange = (_e, v) =>
    update({ ellipse: { ...(config.ellipse || {}), a: v } });
  const handleEllipseBChange = (_e, v) =>
    update({ ellipse: { ...(config.ellipse || {}), b: v } });
  const handleCameraDistanceChange = (_e, v) => update({ cameraDistance: v });
  const handleTiltXChange = (_e, v) => update({ viewTiltXDeg: v });
  const handleTiltYChange = (_e, v) => update({ viewTiltYDeg: v });
  const handleDepthAmpChange = (_e, v) => update({ depthAmplitude: v });
  const handleDepthPhaseChange = (_e, v) => update({ depthPhaseDeg: v });

  // Path handlers
  const setPath = (id, patch) => {
    onConfigChange({
      ...config,
      paths: (config.paths || []).map((p) =>
        p.id === id ? { ...p, ...patch } : p
      ),
    });
  };

  const handleAddPath = () => {
    const newPath = {
      id: Date.now(),
      startVertex: "TR",
      endVertex: "BL",
      delay: 0,
      enabled: true,
    };
    onConfigChange({ ...config, paths: [...(config.paths || []), newPath] });
  };

  const handleDeletePath = (id) => {
    onConfigChange({
      ...config,
      paths: (config.paths || []).filter((p) => p.id !== id),
    });
  };
  const handleTogglePath = (id) => {
    const current = (config.paths || []).find((p) => p.id === id);
    setPath(id, { enabled: !current?.enabled });
  };

  const VertexPicker = ({ value, onChange }) => (
    <Box display="flex" gap={1} flexWrap="wrap">
      {VERTEX_LABELS.map((v) => (
        <Button
          key={v.id}
          variant={value === v.id ? "contained" : "outlined"}
          onClick={() => onChange(v.id)}
          size="small"
          sx={{
            minWidth: 0,
            px: 1.25,
            borderColor: value === v.id ? "#FFD700" : "rgba(255, 215, 0, 0.4)",
            color: value === v.id ? "#000" : "#FFD700",
            backgroundColor: value === v.id ? "#FFD700" : "transparent",
            "&:hover": {
              borderColor: "#FFA500",
              backgroundColor:
                value === v.id ? "#FFA500" : "rgba(255, 215, 0, 0.1)",
            },
          }}
        >
          {v.id}
          <Typography variant="caption" sx={{ ml: 0.5, opacity: 0.8 }}>
            {v.label}
          </Typography>
        </Button>
      ))}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "#000000",
          border: "1px solid #FFD700",
          borderRadius: "12px",
          maxHeight: "90vh",
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        },
      }}
    >
      <DialogTitle
        sx={{ borderBottom: "1px solid rgba(255, 215, 0, 0.2)", pb: 2 }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Settings sx={{ color: "#FFD700" }} />
          <Typography variant="h6" sx={{ color: "#FFD700", fontWeight: 600 }}>
            Animation Configuration
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent
        sx={{
          pt: 3,
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          overflowY: "auto",
        }}
      >
        <Stack spacing={3}>
          {/* Global Timing/Appearance */}
          <Box>
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1 }}
            >
              Animation Time (ms)
            </Typography>
            <Slider
              value={config.animationTimeMs ?? 1200}
              onChange={handleAnimationTimeChange}
              min={100}
              max={10000}
              step={50}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box>
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1 }}
            >
              Glow Radius (px)
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255, 215, 0, 0.7)", display: "block", mb: 1 }}
            >
              0.9 opacity at circle edge, fading to near 0 at edge
            </Typography>
            <Slider
              value={config.glowRadius ?? 20}
              onChange={handleGlowRadiusChange}
              min={0}
              max={100}
              step={1}
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Ellipse */}
          <Box>
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1 }}
            >
              Ellipse a (px)
            </Typography>
            <Slider
              value={config.ellipse?.a ?? 150}
              onChange={handleEllipseAChange}
              min={10}
              max={600}
              step={5}
              valueLabelDisplay="auto"
            />
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1, mt: 1.5 }}
            >
              Ellipse b (px)
            </Typography>
            <Slider
              value={config.ellipse?.b ?? 12}
              onChange={handleEllipseBChange}
              min={1}
              max={200}
              step={1}
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Radii/Length */}
          <Box>
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1 }}
            >
              Center Radius (px)
            </Typography>
            <Slider
              value={config.centerRadius ?? 8}
              onChange={handleCenterRadiusChange}
              min={0}
              max={40}
              step={0.5}
              valueLabelDisplay="auto"
            />
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1, mt: 1.5 }}
            >
              End Radius (px)
            </Typography>
            <Slider
              value={config.endRadius ?? 0}
              onChange={handleEndRadiusChange}
              min={0}
              max={40}
              step={0.5}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box>
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1 }}
            >
              Line Length (px)
            </Typography>
            <Slider
              value={config.length ?? 300}
              onChange={handleLengthChange}
              min={50}
              max={800}
              step={10}
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Camera & Depth */}
          <Box>
            <Typography
              variant="h6"
              sx={{ color: "#FFD700", fontWeight: 600, mb: 1 }}
            >
              Camera & Depth
            </Typography>
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1 }}
            >
              Camera Distance (px)
            </Typography>
            <Slider
              value={config.cameraDistance ?? 4000}
              onChange={handleCameraDistanceChange}
              min={500}
              max={8000}
              step={50}
              valueLabelDisplay="auto"
            />
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1, mt: 1.5 }}
            >
              Camera Tilt X (deg)
            </Typography>
            <Slider
              value={config.viewTiltXDeg ?? 0}
              onChange={handleTiltXChange}
              min={-60}
              max={60}
              step={1}
              valueLabelDisplay="auto"
            />
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1, mt: 1.5 }}
            >
              Camera Tilt Y (deg)
            </Typography>
            <Slider
              value={config.viewTiltYDeg ?? 0}
              onChange={handleTiltYChange}
              min={-60}
              max={60}
              step={1}
              valueLabelDisplay="auto"
            />
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1, mt: 1.5 }}
            >
              Depth Amplitude (px)
            </Typography>
            <Slider
              value={config.depthAmplitude ?? 100}
              onChange={handleDepthAmpChange}
              min={0}
              max={400}
              step={5}
              valueLabelDisplay="auto"
            />
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1, mt: 1.5 }}
            >
              Depth Phase (deg)
            </Typography>
            <Slider
              value={config.depthPhaseDeg ?? 0}
              onChange={handleDepthPhaseChange}
              min={-180}
              max={180}
              step={1}
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Paths Section */}
          <Box>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography
                variant="h6"
                sx={{ color: "#FFD700", fontWeight: 600 }}
              >
                Paths
              </Typography>
              <Button
                startIcon={<Add />}
                variant="contained"
                onClick={handleAddPath}
                size="small"
                sx={{
                  backgroundColor: "#FFD700",
                  color: "#000000",
                  fontWeight: 600,
                  "&:hover": { backgroundColor: "#FFA500" },
                }}
              >
                Add Path
              </Button>
            </Box>

            <Stack spacing={2}>
              {(config.paths || []).map((path) => (
                <Box
                  key={path.id}
                  sx={{
                    p: 2,
                    border: "1px solid",
                    borderColor: "rgba(255, 215, 0, 0.3)",
                    borderRadius: 2,
                    bgcolor: path.enabled
                      ? "rgba(255, 215, 0, 0.05)"
                      : "rgba(255, 215, 0, 0.02)",
                    transition: "all 0.2s ease",
                    "&:hover": { borderColor: "rgba(255, 215, 0, 0.5)" },
                  }}
                >
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2}
                  >
                    <Chip
                      label={`Start ${path.startVertex || "TR"} → End ${
                        path.endVertex || "BL"
                      }`}
                      onClick={() => handleTogglePath(path.id)}
                      sx={{
                        backgroundColor: path.enabled
                          ? "rgba(255, 215, 0, 0.2)"
                          : "rgba(255, 215, 0, 0.05)",
                        color: path.enabled
                          ? "#FFD700"
                          : "rgba(255, 215, 0, 0.5)",
                        border: `1px solid ${
                          path.enabled ? "#FFD700" : "rgba(255, 215, 0, 0.3)"
                        }`,
                        fontWeight: path.enabled ? 600 : 400,
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: path.enabled
                            ? "rgba(255, 215, 0, 0.3)"
                            : "rgba(255, 215, 0, 0.1)",
                        },
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleDeletePath(path.id)}
                      sx={{
                        color: "#FF6B6B",
                        "&:hover": {
                          backgroundColor: "rgba(255, 107, 107, 0.1)",
                        },
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </Box>

                  <Stack spacing={2}>
                    <Box>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500 }}
                      >
                        Start Vertex
                      </Typography>
                      <VertexPicker
                        value={path.startVertex || "TR"}
                        onChange={(v) => setPath(path.id, { startVertex: v })}
                      />
                    </Box>
                    <Box>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500 }}
                      >
                        End Vertex
                      </Typography>
                      <VertexPicker
                        value={path.endVertex || "BL"}
                        onChange={(v) => setPath(path.id, { endVertex: v })}
                      />
                    </Box>

                    <Box>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500 }}
                      >
                        Delay (ms or s if ≤ 20)
                      </Typography>
                      <Slider
                        value={path.delay || 0}
                        onChange={(_e, v) => setPath(path.id, { delay: v })}
                        min={0}
                        max={5000}
                        step={50}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                    </Box>

                    <Box>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500 }}
                      >
                        Override Animation Time (ms)
                      </Typography>
                      <Slider
                        value={
                          path.animationTimeMs ?? config.animationTimeMs ?? 1200
                        }
                        onChange={(_e, v) =>
                          setPath(path.id, { animationTimeMs: v })
                        }
                        min={100}
                        max={10000}
                        step={50}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                    </Box>

                    {/* Ellipse overrides */}
                    <Box>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500 }}
                      >
                        Ellipse a (px)
                      </Typography>
                      <Slider
                        value={path.ellipse?.a ?? config.ellipse?.a ?? 150}
                        onChange={(_e, v) =>
                          setPath(path.id, {
                            ellipse: { ...(path.ellipse || {}), a: v },
                          })
                        }
                        min={10}
                        max={600}
                        step={5}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500, mt: 1 }}
                      >
                        Ellipse b (px)
                      </Typography>
                      <Slider
                        value={path.ellipse?.b ?? config.ellipse?.b ?? 12}
                        onChange={(_e, v) =>
                          setPath(path.id, {
                            ellipse: { ...(path.ellipse || {}), b: v },
                          })
                        }
                        min={1}
                        max={200}
                        step={1}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500, mt: 1 }}
                      >
                        Ellipse Rotation (deg)
                      </Typography>
                      <Slider
                        value={path.ellipseRotationDeg ?? 0}
                        onChange={(_e, v) =>
                          setPath(path.id, { ellipseRotationDeg: v })
                        }
                        min={-180}
                        max={180}
                        step={1}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                    </Box>

                    {/* Camera & depth overrides */}
                    <Box>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500 }}
                      >
                        Camera Distance (px)
                      </Typography>
                      <Slider
                        value={
                          path.cameraDistance ?? config.cameraDistance ?? 4000
                        }
                        onChange={(_e, v) =>
                          setPath(path.id, { cameraDistance: v })
                        }
                        min={500}
                        max={8000}
                        step={50}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500, mt: 1 }}
                      >
                        Camera Tilt X (deg)
                      </Typography>
                      <Slider
                        value={path.viewTiltXDeg ?? config.viewTiltXDeg ?? 0}
                        onChange={(_e, v) =>
                          setPath(path.id, { viewTiltXDeg: v })
                        }
                        min={-60}
                        max={60}
                        step={1}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500, mt: 1 }}
                      >
                        Camera Tilt Y (deg)
                      </Typography>
                      <Slider
                        value={path.viewTiltYDeg ?? config.viewTiltYDeg ?? 0}
                        onChange={(_e, v) =>
                          setPath(path.id, { viewTiltYDeg: v })
                        }
                        min={-60}
                        max={60}
                        step={1}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500, mt: 1 }}
                      >
                        Depth Amplitude (px)
                      </Typography>
                      <Slider
                        value={
                          path.depthAmplitude ?? config.depthAmplitude ?? 100
                        }
                        onChange={(_e, v) =>
                          setPath(path.id, { depthAmplitude: v })
                        }
                        min={0}
                        max={400}
                        step={5}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500, mt: 1 }}
                      >
                        Depth Phase (deg)
                      </Typography>
                      <Slider
                        value={path.depthPhaseDeg ?? config.depthPhaseDeg ?? 0}
                        onChange={(_e, v) =>
                          setPath(path.id, { depthPhaseDeg: v })
                        }
                        min={-180}
                        max={180}
                        step={1}
                        size="small"
                        valueLabelDisplay="auto"
                      />
                    </Box>
                  </Stack>
                </Box>
              ))}

              {(!config.paths || config.paths.length === 0) && (
                <Typography
                  align="center"
                  sx={{
                    py: 4,
                    color: "rgba(255, 215, 0, 0.5)",
                    fontStyle: "italic",
                  }}
                >
                  No paths configured. Click {'"'}Add Path{'"'} to create one.
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{ borderTop: "1px solid rgba(255, 215, 0, 0.2)", px: 3, py: 2 }}
      >
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            backgroundColor: "#FFD700",
            color: "#000000",
            fontWeight: 600,
            "&:hover": { backgroundColor: "#FFA500" },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
