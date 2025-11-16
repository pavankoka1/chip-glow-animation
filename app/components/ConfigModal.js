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
import { useMemo, useState } from "react";
import { VERTEX_LABELS } from "./animation/constants";

export default function ConfigModal({ open, onClose, config, onConfigChange }) {
  // Remount on open toggles to re-initialize draft from config without setState in effect
  const instanceKey = useMemo(
    () => (open ? JSON.stringify(config) : "closed"),
    [open, config]
  );
  return (
    <ConfigModalBody
      key={instanceKey}
      open={open}
      onClose={onClose}
      config={config}
      onConfigChange={onConfigChange}
    />
  );
}

function ConfigModalBody({ open, onClose, config, onConfigChange }) {
  const [draft, setDraft] = useState(config);

  const update = (partial) => setDraft({ ...draft, ...partial });

  // Global handlers
  const handleAnimationTimeChange = (_e, v) => update({ animationTimeMs: v });
  const handleGlowRadiusChange = (_e, v) => update({ glowRadius: v });
  const handleCenterRadiusChange = (_e, v) => update({ centerRadius: v });
  const handleEndRadiusChange = (_e, v) => update({ endRadius: v });
  const handleLengthChange = (_e, v) => update({ length: v });
  const handleEllipseAChange = (_e, v) =>
    update({ ellipse: { ...(draft.ellipse || {}), a: v } });
  const handleEllipseBChange = (_e, v) =>
    update({ ellipse: { ...(draft.ellipse || {}), b: v } });
  const handleCameraDistanceChange = (_e, v) => update({ cameraDistance: v });
  const handleTiltXChange = (_e, v) => update({ viewTiltXDeg: v });
  const handleTiltYChange = (_e, v) => update({ viewTiltYDeg: v });
  const handleDepthAmpChange = (_e, v) => update({ depthAmplitude: v });
  const handleDepthPhaseChange = (_e, v) => update({ depthPhaseDeg: v });

  // Path handlers
  const setPath = (id, patch) => {
    setDraft({
      ...draft,
      paths: (draft.paths || []).map((p) =>
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
    setDraft({ ...draft, paths: [...(draft.paths || []), newPath] });
  };

  const handleDeletePath = (id) => {
    setDraft({
      ...draft,
      paths: (draft.paths || []).filter((p) => p.id !== id),
    });
  };
  const handleTogglePath = (id) => {
    const current = (draft.paths || []).find((p) => p.id === id);
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
            px: 1,
            py: 0.25,
            borderColor: value === v.id ? "#FFD700" : "rgba(255, 215, 0, 0.4)",
            color: value === v.id ? "#000" : "#FFD700",
            backgroundColor: value === v.id ? "#FFD700" : "transparent",
            fontSize: 12,
            "&:hover": {
              borderColor: "#FFA500",
              backgroundColor:
                value === v.id ? "#FFA500" : "rgba(255, 215, 0, 0.1)",
            },
          }}
        >
          {v.id}
        </Button>
      ))}
    </Box>
  );

  const handleSubmit = () => {
    onConfigChange(draft);
    onClose();
  };

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
        sx={{ borderBottom: "1px solid rgba(255, 215, 0, 0.2)", pb: 1.25 }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Settings sx={{ color: "#FFD700", fontSize: 18 }} />
          <Typography
            variant="body1"
            sx={{ color: "#FFD700", fontWeight: 600 }}
          >
            Animation Configuration
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent
        sx={{
          pt: 2,
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          overflowY: "auto",
        }}
      >
        <Stack spacing={2}>
          {/* Global Timing/Appearance */}
          <Box>
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5 }}
            >
              Animation Time (ms)
            </Typography>
            <Slider
              size="small"
              value={draft.animationTimeMs ?? 1200}
              onChange={handleAnimationTimeChange}
              min={100}
              max={10000}
              step={50}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box>
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5 }}
            >
              Glow Radius (px)
            </Typography>
            <Slider
              size="small"
              value={draft.glowRadius ?? 20}
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
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5 }}
            >
              Ellipse a (px)
            </Typography>
            <Slider
              size="small"
              value={draft.ellipse?.a ?? 150}
              onChange={handleEllipseAChange}
              min={10}
              max={600}
              step={5}
              valueLabelDisplay="auto"
            />
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5, mt: 1 }}
            >
              Ellipse b (px)
            </Typography>
            <Slider
              size="small"
              value={draft.ellipse?.b ?? 12}
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
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5 }}
            >
              Center Radius (px)
            </Typography>
            <Slider
              size="small"
              value={draft.centerRadius ?? 8}
              onChange={handleCenterRadiusChange}
              min={0}
              max={40}
              step={0.5}
              valueLabelDisplay="auto"
            />
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5, mt: 1 }}
            >
              End Radius (px)
            </Typography>
            <Slider
              size="small"
              value={draft.endRadius ?? 0}
              onChange={handleEndRadiusChange}
              min={0}
              max={40}
              step={0.5}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box>
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5 }}
            >
              Line Length (px)
            </Typography>
            <Slider
              size="small"
              value={draft.length ?? 300}
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
              variant="body2"
              sx={{ color: "#FFD700", fontWeight: 600, mb: 0.5 }}
            >
              Camera & Depth
            </Typography>
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5 }}
            >
              Camera Distance (px)
            </Typography>
            <Slider
              size="small"
              value={draft.cameraDistance ?? 4000}
              onChange={handleCameraDistanceChange}
              min={500}
              max={8000}
              step={50}
              valueLabelDisplay="auto"
            />
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5, mt: 1 }}
            >
              Camera Tilt X (deg)
            </Typography>
            <Slider
              size="small"
              value={draft.viewTiltXDeg ?? 0}
              onChange={handleTiltXChange}
              min={-60}
              max={60}
              step={1}
              valueLabelDisplay="auto"
            />
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5, mt: 1 }}
            >
              Camera Tilt Y (deg)
            </Typography>
            <Slider
              size="small"
              value={draft.viewTiltYDeg ?? 0}
              onChange={handleTiltYChange}
              min={-60}
              max={60}
              step={1}
              valueLabelDisplay="auto"
            />
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5, mt: 1 }}
            >
              Depth Amplitude (px)
            </Typography>
            <Slider
              size="small"
              value={draft.depthAmplitude ?? 0}
              onChange={handleDepthAmpChange}
              min={0}
              max={400}
              step={5}
              valueLabelDisplay="auto"
            />
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5, mt: 1 }}
            >
              Depth Phase (deg)
            </Typography>
            <Slider
              size="small"
              value={draft.depthPhaseDeg ?? 0}
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
              mb={1.5}
            >
              <Typography
                variant="body1"
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

            <Stack spacing={1.5}>
              {(draft.paths || []).map((path) => (
                <Box
                  key={path.id}
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: "rgba(255, 215, 0, 0.3)",
                    borderRadius: 1.5,
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
                    mb={1.25}
                  >
                    <Chip
                      label={`Start ${path.startVertex || "TR"} → End ${
                        path.endVertex || "BL"
                      }`}
                      onClick={() => handleTogglePath(path.id)}
                      size="small"
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
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>

                  <Stack spacing={1.25}>
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
                        size="small"
                        value={path.delay || 0}
                        onChange={(_e, v) => setPath(path.id, { delay: v })}
                        min={0}
                        max={5000}
                        step={50}
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
                        size="small"
                        value={
                          path.animationTimeMs ?? draft.animationTimeMs ?? 1200
                        }
                        onChange={(_e, v) =>
                          setPath(path.id, { animationTimeMs: v })
                        }
                        min={100}
                        max={10000}
                        step={50}
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
                        size="small"
                        value={path.ellipse?.a ?? draft.ellipse?.a ?? 150}
                        onChange={(_e, v) =>
                          setPath(path.id, {
                            ellipse: { ...(path.ellipse || {}), a: v },
                          })
                        }
                        min={10}
                        max={600}
                        step={5}
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
                        size="small"
                        value={path.ellipse?.b ?? draft.ellipse?.b ?? 12}
                        onChange={(_e, v) =>
                          setPath(path.id, {
                            ellipse: { ...(path.ellipse || {}), b: v },
                          })
                        }
                        min={1}
                        max={200}
                        step={1}
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
                        size="small"
                        value={path.ellipseRotationDeg ?? 0}
                        onChange={(_e, v) =>
                          setPath(path.id, { ellipseRotationDeg: v })
                        }
                        min={-180}
                        max={180}
                        step={1}
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
                        size="small"
                        value={
                          path.cameraDistance ?? draft.cameraDistance ?? 4000
                        }
                        onChange={(_e, v) =>
                          setPath(path.id, { cameraDistance: v })
                        }
                        min={500}
                        max={8000}
                        step={50}
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
                        size="small"
                        value={path.viewTiltXDeg ?? draft.viewTiltXDeg ?? 0}
                        onChange={(_e, v) =>
                          setPath(path.id, { viewTiltXDeg: v })
                        }
                        min={-60}
                        max={60}
                        step={1}
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
                        size="small"
                        value={path.viewTiltYDeg ?? draft.viewTiltYDeg ?? 0}
                        onChange={(_e, v) =>
                          setPath(path.id, { viewTiltYDeg: v })
                        }
                        min={-60}
                        max={60}
                        step={1}
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
                        size="small"
                        value={path.depthAmplitude ?? draft.depthAmplitude ?? 0}
                        onChange={(_e, v) =>
                          setPath(path.id, { depthAmplitude: v })
                        }
                        min={0}
                        max={400}
                        step={5}
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
                        size="small"
                        value={path.depthPhaseDeg ?? draft.depthPhaseDeg ?? 0}
                        onChange={(_e, v) =>
                          setPath(path.id, { depthPhaseDeg: v })
                        }
                        min={-180}
                        max={180}
                        step={1}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                  </Stack>
                </Box>
              ))}

              {(!draft.paths || draft.paths.length === 0) && (
                <Typography
                  align="center"
                  sx={{
                    py: 3,
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
        sx={{ borderTop: "1px solid rgba(255, 215, 0, 0.2)", px: 2, py: 1 }}
      >
        <Button size="small" onClick={onClose} sx={{ color: "#FFD700" }}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          size="small"
          variant="contained"
          sx={{
            backgroundColor: "#FFD700",
            color: "#000000",
            fontWeight: 600,
            "&:hover": { backgroundColor: "#FFA500" },
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
