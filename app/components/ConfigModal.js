"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Slider,
  Box,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
} from "@mui/material";
import { Add, Delete, Settings } from "@mui/icons-material";

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

  const handleCenterThicknessChange = (event, newValue) => {
    onConfigChange({ ...config, centerThickness: newValue });
  };

  const handleEndThicknessChange = (event, newValue) => {
    onConfigChange({ ...config, endThickness: newValue });
  };

  const handleAddPath = () => {
    const newPath = {
      id: Date.now(),
      type: "diagonal-tl-br",
      speed: config.speed,
      delay: 0,
      glow: config.glow,
      centerThickness: config.centerThickness,
      endThickness: config.endThickness,
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Settings />
          <Typography variant="h6">Animation Configuration</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Global Speed Control */}
          <Box>
            <Typography gutterBottom>Global Speed</Typography>
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
            <Typography gutterBottom variant="subtitle2">
              Global Glow Intensity
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Controls the glow/halo effect around the line (0 = no glow, 10 = maximum glow)
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

          {/* Global Line Size Controls */}
          <Box>
            <Typography gutterBottom variant="subtitle2">
              Global Line Size
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Center Thickness (Middle Radius):{" "}
                {(config.centerThickness || 4.0).toFixed(1)}px
              </Typography>
              <Slider
                value={config.centerThickness || 4.0}
                onChange={handleCenterThicknessChange}
                min={0.5}
                max={20}
                step={0.5}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value.toFixed(1)}px`}
              />
            </Box>
            <Box>
              <Typography variant="body2" gutterBottom>
                End Thickness (End Radius):{" "}
                {(config.endThickness || 1.0).toFixed(1)}px
              </Typography>
              <Slider
                value={config.endThickness || 1.0}
                onChange={handleEndThicknessChange}
                min={0.5}
                max={10}
                step={0.5}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value.toFixed(1)}px`}
              />
            </Box>
          </Box>

          {/* Paths Section */}
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Paths</Typography>
              <Button
                startIcon={<Add />}
                variant="contained"
                onClick={handleAddPath}
                size="small"
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
                    borderColor: "divider",
                    borderRadius: 1,
                    bgcolor: path.enabled ? "background.paper" : "action.disabledBackground",
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Chip
                      label={PATH_TYPES.find((t) => t.value === path.type)?.label || path.type}
                      color={path.enabled ? "primary" : "default"}
                      onClick={() => handleTogglePath(path.id)}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleDeletePath(path.id)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </Box>

                  <Stack spacing={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Path Type</InputLabel>
                      <Select
                        value={path.type}
                        label="Path Type"
                        onChange={(e) => handlePathChange(path.id, "type", e.target.value)}
                      >
                        {PATH_TYPES.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Speed: {path.speed?.toFixed(1) || config.speed?.toFixed(1) || "2.0"}x
                      </Typography>
                      <Slider
                        value={path.speed || config.speed || 2.0}
                        onChange={(e, newValue) => handlePathChange(path.id, "speed", newValue)}
                        min={0.1}
                        max={10}
                        step={0.1}
                        size="small"
                      />
                    </Box>

                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Delay: {path.delay?.toFixed(2) || "0.00"}s
                      </Typography>
                      <Slider
                        value={path.delay || 0}
                        onChange={(e, newValue) => handlePathChange(path.id, "delay", newValue)}
                        min={0}
                        max={5}
                        step={0.1}
                        size="small"
                      />
                    </Box>

                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Glow: {path.glow?.toFixed(1) || config.glow?.toFixed(1) || "3.0"}
                      </Typography>
                      <Slider
                        value={path.glow || config.glow || 3.0}
                        onChange={(e, newValue) => handlePathChange(path.id, "glow", newValue)}
                        min={0}
                        max={10}
                        step={0.1}
                        size="small"
                      />
                    </Box>

                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Center Thickness:{" "}
                        {(
                          path.centerThickness ||
                          config.centerThickness ||
                          4.0
                        ).toFixed(1)}px
                      </Typography>
                      <Slider
                        value={
                          path.centerThickness ||
                          config.centerThickness ||
                          4.0
                        }
                        onChange={(e, newValue) =>
                          handlePathChange(path.id, "centerThickness", newValue)
                        }
                        min={0.5}
                        max={20}
                        step={0.5}
                        size="small"
                      />
                    </Box>

                    <Box>
                      <Typography variant="body2" gutterBottom>
                        End Thickness:{" "}
                        {(path.endThickness || config.endThickness || 1.0).toFixed(1)}px
                      </Typography>
                      <Slider
                        value={path.endThickness || config.endThickness || 1.0}
                        onChange={(e, newValue) =>
                          handlePathChange(path.id, "endThickness", newValue)
                        }
                        min={0.5}
                        max={10}
                        step={0.5}
                        size="small"
                      />
                    </Box>
                  </Stack>
                </Box>
              ))}

              {(!config.paths || config.paths.length === 0) && (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  No paths configured. Click "Add Path" to create one.
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

