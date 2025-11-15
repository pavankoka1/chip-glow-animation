"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Gold color theme
const goldColor = "#FFD700"; // RGB(255, 215, 0)
const darkGold = "#FFA500"; // Darker gold for hover
const lightGold = "#FFED4E"; // Lighter gold

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: goldColor,
      light: lightGold,
      dark: darkGold,
      contrastText: "#000000",
    },
    background: {
      default: "#000000",
      paper: "#0a0a0a",
    },
    text: {
      primary: goldColor,
      secondary: lightGold,
    },
    divider: "rgba(255, 215, 0, 0.2)",
  },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: "#000000",
          border: `1px solid ${goldColor}`,
          borderRadius: "12px",
          "&::-webkit-scrollbar": {
            display: "none",
          },
          scrollbarWidth: "none",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          "&::-webkit-scrollbar": {
            display: "none",
          },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: goldColor,
        },
        thumb: {
          "&:hover": {
            boxShadow: `0 0 0 8px rgba(255, 215, 0, 0.16)`,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        contained: {
          backgroundColor: goldColor,
          color: "#000000",
          "&:hover": {
            backgroundColor: darkGold,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255, 215, 0, 0.1)",
          color: goldColor,
          border: `1px solid ${goldColor}`,
          "&:hover": {
            backgroundColor: "rgba(255, 215, 0, 0.2)",
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          color: goldColor,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: goldColor,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: lightGold,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: goldColor,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: goldColor,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: goldColor,
          "&:hover": {
            backgroundColor: "rgba(255, 215, 0, 0.1)",
          },
        },
      },
    },
  },
});

export default function ThemeProviderWrapper({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}


