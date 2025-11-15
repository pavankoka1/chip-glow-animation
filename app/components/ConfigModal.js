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
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Typography,
} from "@mui/material";

const PATH_TYPES = [
  { value: "diagonal-tl-br", label: "Top Left to Bottom Right" },
  { value: "diagonal-tr-bl", label: "Top Right to Bottom Left" },
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
];

export default function ConfigModal({ open, onClose, config, onConfigChange }) {
  const handleSpeedChange = (event, newValue) => {
    onConfigChange({ ...config, speed: newValue });
  };

  const handleGlowChange = (event, newValue) => {
    onConfigChange({ ...config, glow: newValue });
  };

  const handleCenterRadiusChange = (event, newValue) => {
    onConfigChange({ ...config, centerRadius: newValue });
  };

  const handleLengthChange = (event, newValue) => {
    onConfigChange({ ...config, length: newValue });
  };

  const handleAddPath = () => {
    const newPath = {
      id: Date.now(),
      type: "diagonal-tl-br",
      speed: config.speed,
      delay: 0,
      glow: config.glow,
      centerRadius: config.centerRadius,
      enabled: true,
    };
    onConfigChange({
      ...config,
      paths: [...(config.paths || []), newPath],
    });
  };

  const handlePathChange = (pathId, field, value) => {
    onConfigChange({
      ...config,
      paths: config.paths.map((path) =>
        path.id === pathId ? { ...path, [field]: value } : path
      ),
    });
  };

  const handleDeletePath = (pathId) => {
    onConfigChange({
      ...config,
      paths: config.paths.filter((path) => path.id !== pathId),
    });
  };

  const handleTogglePath = (pathId) => {
    onConfigChange({
      ...config,
      paths: config.paths.map((path) =>
        path.id === pathId ? { ...path, enabled: !path.enabled } : path
      ),
    });
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
          "&::-webkit-scrollbar": {
            display: "none",
          },
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
          "&::-webkit-scrollbar": {
            display: "none",
          },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          overflowY: "auto",
        }}
      >
        <Stack spacing={3}>
          {/* Global Speed Control */}
          <Box>
            <Typography
              gutterBottom
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1 }}
            >
              Global Speed
            </Typography>
            <Slider
              value={config.speed || 2.0}
              onChange={handleSpeedChange}
              min={0.1}
              max={10}
              step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value.toFixed(1)}x`}
            />
          </Box>

          {/* Global Glow Control */}
          <Box>
            <Typography
              gutterBottom
              variant="subtitle2"
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1 }}
            >
              Global Glow Intensity
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255, 215, 0, 0.7)", display: "block", mb: 1 }}
            >
              Controls the glow/halo effect around the circles (0 = no glow, 10
              = maximum glow)
            </Typography>
            <Slider
              value={config.glow || 3.0}
              onChange={handleGlowChange}
              min={0}
              max={10}
              step={0.1}
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Global Center Radius Control */}
          <Box>
            <Typography
              gutterBottom
              variant="subtitle2"
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1 }}
            >
              Center Radius
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255, 215, 0, 0.7)", display: "block", mb: 1 }}
            >
              Controls the radius of circles at the center of the animation
              (ends taper to 0px)
            </Typography>
            <Slider
              value={config.centerRadius || 2.0}
              onChange={handleCenterRadiusChange}
              min={0.5}
              max={10}
              step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value.toFixed(1)}px`}
            />
          </Box>

          {/* Global Length Control */}
          <Box>
            <Typography
              gutterBottom
              variant="subtitle2"
              sx={{ color: "#FFD700", fontWeight: 500, mb: 1 }}
            >
              Line Length
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255, 215, 0, 0.7)", display: "block", mb: 1 }}
            >
              Controls the length of the line segment formed by circles
              (default: 200px)
            </Typography>
            <Slider
              value={config.length || 200.0}
              onChange={handleLengthChange}
              min={50}
              max={500}
              step={10}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value.toFixed(0)}px`}
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
                  "&:hover": {
                    backgroundColor: "#FFA500",
                  },
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
                    "&:hover": {
                      borderColor: "rgba(255, 215, 0, 0.5)",
                    },
                  }}
                >
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2}
                  >
                    <Chip
                      label={
                        PATH_TYPES.find((t) => t.value === path.type)?.label ||
                        path.type
                      }
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
                    <FormControl fullWidth size="small">
                      <InputLabel sx={{ color: "#FFD700" }}>
                        Path Type
                      </InputLabel>
                      <Select
                        value={path.type}
                        label="Path Type"
                        onChange={(e) =>
                          handlePathChange(path.id, "type", e.target.value)
                        }
                        sx={{
                          color: "#FFD700",
                          "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: "rgba(255, 215, 0, 0.5)",
                          },
                          "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#FFD700",
                          },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#FFD700",
                          },
                          "& .MuiSvgIcon-root": {
                            color: "#FFD700",
                          },
                        }}
                      >
                        {PATH_TYPES.map((type) => (
                          <MenuItem
                            key={type.value}
                            value={type.value}
                            sx={{
                              color: "#FFD700",
                              "&:hover": {
                                backgroundColor: "rgba(255, 215, 0, 0.1)",
                              },
                              "&.Mui-selected": {
                                backgroundColor: "rgba(255, 215, 0, 0.2)",
                                "&:hover": {
                                  backgroundColor: "rgba(255, 215, 0, 0.3)",
                                },
                              },
                            }}
                          >
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Box>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500 }}
                      >
                        Speed:{" "}
                        {path.speed?.toFixed(1) ||
                          config.speed?.toFixed(1) ||
                          "2.0"}
                        x
                      </Typography>
                      <Slider
                        value={path.speed || config.speed || 2.0}
                        onChange={(e, newValue) =>
                          handlePathChange(path.id, "speed", newValue)
                        }
                        min={0.1}
                        max={10}
                        step={0.1}
                        size="small"
                      />
                    </Box>

                    <Box>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500 }}
                      >
                        Delay: {path.delay?.toFixed(2) || "0.00"}s
                      </Typography>
                      <Slider
                        value={path.delay || 0}
                        onChange={(e, newValue) =>
                          handlePathChange(path.id, "delay", newValue)
                        }
                        min={0}
                        max={5}
                        step={0.1}
                        size="small"
                      />
                    </Box>

                    <Box>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500 }}
                      >
                        Glow:{" "}
                        {path.glow?.toFixed(1) ||
                          config.glow?.toFixed(1) ||
                          "3.0"}
                      </Typography>
                      <Slider
                        value={path.glow || config.glow || 3.0}
                        onChange={(e, newValue) =>
                          handlePathChange(path.id, "glow", newValue)
                        }
                        min={0}
                        max={10}
                        step={0.1}
                        size="small"
                      />
                    </Box>

                    <Box>
                      <Typography
                        variant="body2"
                        gutterBottom
                        sx={{ color: "#FFD700", fontWeight: 500 }}
                      >
                        Center Radius:{" "}
                        {(
                          path.centerRadius ||
                          config.centerRadius ||
                          2.0
                        ).toFixed(1)}
                        px
                      </Typography>
                      <Slider
                        value={path.centerRadius || config.centerRadius || 2.0}
                        onChange={(e, newValue) =>
                          handlePathChange(path.id, "centerRadius", newValue)
                        }
                        min={0.5}
                        max={10}
                        step={0.1}
                        size="small"
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value.toFixed(1)}px`}
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
            "&:hover": {
              backgroundColor: "#FFA500",
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
