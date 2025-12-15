/**
 * Geometry utility functions
 */

import {
  calculateAutoA as calculateAutoAOriginal,
  getDynamicRotAngle as getDynamicRotAngleOriginal,
} from "../../canvas2d/geometry";
import { getAngleForVertex } from "../../canvas2d/utils";

// Re-export geometry functions
export {
  calculateAutoAOriginal as calculateAutoA,
  getAngleForVertex,
  getDynamicRotAngleOriginal as getDynamicRotAngle,
};
