"use client";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";

export default function BetSpotSelectorModal({
  open,
  onClose,
  betspotCount = 5,
  selectedBetspots,
  onSelectionChange,
}) {
  const [localSelection, setLocalSelection] = useState(
    selectedBetspots || Array(betspotCount).fill(true)
  );

  const handleToggle = (index) => {
    const newSelection = [...localSelection];
    newSelection[index] = !newSelection[index];
    setLocalSelection(newSelection);
  };

  const handleSelectAll = () => {
    setLocalSelection(Array(betspotCount).fill(true));
  };

  const handleDeselectAll = () => {
    setLocalSelection(Array(betspotCount).fill(false));
  };

  const handleSubmit = () => {
    onSelectionChange(localSelection);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "#000000",
          border: "1px solid #FFD700",
          borderRadius: "12px",
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
          Select BetSpots to Animate
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={1}>
          <Box display="flex" gap={1} mb={1}>
            <Button
              size="small"
              onClick={handleSelectAll}
              sx={{
                color: "#FFD700",
                borderColor: "rgba(255, 215, 0, 0.4)",
                "&:hover": {
                  borderColor: "#FFD700",
                  bgcolor: "rgba(255, 215, 0, 0.1)",
                },
              }}
              variant="outlined"
            >
              Select All
            </Button>
            <Button
              size="small"
              onClick={handleDeselectAll}
              sx={{
                color: "#FFD700",
                borderColor: "rgba(255, 215, 0, 0.4)",
                "&:hover": {
                  borderColor: "#FFD700",
                  bgcolor: "rgba(255, 215, 0, 0.1)",
                },
              }}
              variant="outlined"
            >
              Deselect All
            </Button>
          </Box>
          {Array.from({ length: betspotCount }).map((_, index) => (
            <FormControlLabel
              key={index}
              control={
                <Checkbox
                  checked={localSelection[index]}
                  onChange={() => handleToggle(index)}
                  sx={{
                    color: "#FFD700",
                    "&.Mui-checked": {
                      color: "#FFD700",
                    },
                  }}
                />
              }
              label={
                <Typography sx={{ color: "#FFD700" }}>
                  BetSpot {index + 1}
                </Typography>
              }
            />
          ))}
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

