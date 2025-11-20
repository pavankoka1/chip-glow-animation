"use client";

import { Add, Delete } from "@mui/icons-material";
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
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { VERTEX_LABELS } from "./animation/constants";

export default function ConfigModal({ open, onClose, config, onConfigChange }) {
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

  
  const handleAnimationTimeChange = (_e, v) => update({ animationTimeMs: v });
  const handleGlowRadiusChange = (_e, v) => update({ glowRadius: v });
  const handleHeadRadiusChange = (_e, v) => update({ headRadius: v });
  const handleTailRadiusChange = (_e, v) => update({ tailRadius: v });
  const handleLengthChange = (_e, v) => update({ length: v });
  const handleEllipseAChange = (_e, v) =>
    update({ ellipse: { ...(draft.ellipse || {}), a: v } });
  const handleEllipseBChange = (_e, v) =>
    update({ ellipse: { ...(draft.ellipse || {}), b: v } });
  const handleSparkColorChange = (e) => update({ sparkColor: e.target.value });
  const handleGlowColorChange = (e) => update({ glowColor: e.target.value });

  
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
      type: "spark",
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
        <Typography
          variant="body1"
          sx={{ color: "#FFD700", fontWeight: 600 }}
        >
          Animation Configuration
        </Typography>
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
          {/* Global Settings */}
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

          <Box>
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5 }}
            >
              Head Radius (px)
            </Typography>
            <Slider
              size="small"
              value={draft.headRadius ?? 10}
              onChange={handleHeadRadiusChange}
              min={1}
              max={50}
              step={0.5}
              valueLabelDisplay="auto"
            />
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5, mt: 1 }}
            >
              Tail Radius (px)
            </Typography>
            <Slider
              size="small"
              value={draft.tailRadius ?? 2}
              onChange={handleTailRadiusChange}
              min={0.5}
              max={20}
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
              Spark Color
            </Typography>
            <TextField
              size="small"
              value={draft.sparkColor ?? "#ffffe0"}
              onChange={handleSparkColorChange}
              type="color"
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  "& fieldset": {
                    borderColor: "rgba(255, 215, 0, 0.4)",
                  },
                  "&:hover fieldset": {
                    borderColor: "#FFD700",
                  },
                },
              }}
            />
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 0.5, mt: 1 }}
            >
              Glow Color
            </Typography>
            <TextField
              size="small"
              value={draft.glowColor ?? "#fffba4"}
              onChange={handleGlowColorChange}
              type="color"
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  "& fieldset": {
                    borderColor: "rgba(255, 215, 0, 0.4)",
                  },
                  "&:hover fieldset": {
                    borderColor: "#FFD700",
                  },
                },
              }}
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
                      label={
                        path.type === "circle"
                          ? `Circle: ${path.startVertex || "BR"}`
                          : `Spark: ${path.startVertex || "TR"} → ${
                              path.endVertex || "BL"
                            }`
                      }
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
                        Path Type
                      </Typography>
                      <Box display="flex" gap={1}>
                        <Button
                          variant={path.type === "spark" || !path.type ? "contained" : "outlined"}
                          onClick={() => setPath(path.id, { type: "spark" })}
                          size="small"
                          sx={{
                            minWidth: 0,
                            px: 2,
                            borderColor: "rgba(255, 215, 0, 0.4)",
                            color: path.type === "spark" || !path.type ? "#000" : "#FFD700",
                            backgroundColor: path.type === "spark" || !path.type ? "#FFD700" : "transparent",
                            "&:hover": {
                              backgroundColor: path.type === "spark" || !path.type ? "#FFA500" : "rgba(255, 215, 0, 0.1)",
                            },
                          }}
                        >
                          Spark
                        </Button>
                        <Button
                          variant={path.type === "circle" ? "contained" : "outlined"}
                          onClick={() => setPath(path.id, { type: "circle" })}
                          size="small"
                          sx={{
                            minWidth: 0,
                            px: 2,
                            borderColor: "rgba(255, 215, 0, 0.4)",
                            color: path.type === "circle" ? "#000" : "#FFD700",
                            backgroundColor: path.type === "circle" ? "#FFD700" : "transparent",
                            "&:hover": {
                              backgroundColor: path.type === "circle" ? "#FFA500" : "rgba(255, 215, 0, 0.1)",
                            },
                          }}
                        >
                          Circle
                        </Button>
                      </Box>
                    </Box>
                    <Box>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500 }}
                      >
                        Start Vertex
                      </Typography>
                      <VertexPicker
                        value={path.startVertex || (path.type === "circle" ? "BR" : "TR")}
                        onChange={(v) => setPath(path.id, { startVertex: v })}
                      />
                    </Box>
                    {path.type !== "circle" && (
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
                    )}
                    {path.type === "circle" && (
                      <Box>
                        <Typography
                          variant="body2"
                          gutterBottom
                          sx={{ color: "#FFD700", fontWeight: 500 }}
                        >
                          Circle Radius (px)
                        </Typography>
                        <Slider
                          size="small"
                          value={path.circleRadius ?? 25}
                          onChange={(_e, v) => setPath(path.id, { circleRadius: v })}
                          min={10}
                          max={100}
                          step={1}
                          valueLabelDisplay="auto"
                        />
                      </Box>
                    )}

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
