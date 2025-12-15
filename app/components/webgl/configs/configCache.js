/**
 * Shared configuration cache for all animation instances
 * Since all betspots use the same config, we can share the cache
 */

let sharedConfigCache = null;
let sharedActivePathsCache = null;
let sharedPathConstantsCache = new Map();
let sharedColorCache = new Map();
// Shared precomputed paths cache - all betspots use the same config, so share precomputed paths
let sharedPrecomputedPathsCache = null;

/**
 * Gets or creates a cached config object
 * @param {Object} config - User config
 * @param {Object} defaultConfig - Default config
 * @returns {Object} Merged config
 */
export function getSharedConfigCache(config, defaultConfig) {
  const configKey = JSON.stringify(config);
  if (!sharedConfigCache || sharedConfigCache.key !== configKey) {
    sharedConfigCache = {
      key: configKey,
      cfg: { ...defaultConfig, ...config },
    };
    // Clear dependent caches when config changes
    sharedActivePathsCache = null;
    sharedPathConstantsCache.clear();
    sharedColorCache.clear();
    sharedPrecomputedPathsCache = null;
  }
  return sharedConfigCache.cfg;
}

/**
 * Gets cached active paths (filtered by enabled flag)
 * @param {Object} cfg - Config object
 * @returns {Array} Array of active paths
 */
export function getSharedActivePaths(cfg) {
  if (!sharedActivePathsCache) {
    sharedActivePathsCache = (cfg.paths || []).filter(
      (p) => p.enabled !== false
    );
  }
  return sharedActivePathsCache;
}

/**
 * Gets or computes path constants with caching
 * @param {string} key - Cache key
 * @param {Function} computeFn - Function to compute value if not cached
 * @returns {*} Cached or computed value
 */
export function getSharedPathConstants(key, computeFn) {
  if (!sharedPathConstantsCache.has(key)) {
    sharedPathConstantsCache.set(key, computeFn());
  }
  return sharedPathConstantsCache.get(key);
}

/**
 * Gets or computes color cache
 * @param {string} key - Cache key
 * @param {Function} computeFn - Function to compute value if not cached
 * @returns {*} Cached or computed value
 */
export function getSharedColorCache(key, computeFn) {
  if (!sharedColorCache.has(key)) {
    sharedColorCache.set(key, computeFn());
  }
  return sharedColorCache.get(key);
}

/**
 * Gets or creates shared precomputed paths
 * @param {Array} activePaths - Active paths array
 * @param {Object} cfg - Config object
 * @param {Function} precomputeFn - Function to precompute paths if not cached
 * @returns {Array} Precomputed paths
 */
export function getSharedPrecomputedPaths(activePaths, cfg, precomputeFn) {
  // Use config key to determine if paths need recomputation
  const configKey = sharedConfigCache?.key;
  if (!sharedPrecomputedPathsCache || !configKey) {
    sharedPrecomputedPathsCache = precomputeFn();
  }
  return sharedPrecomputedPathsCache;
}

/**
 * Clears all shared caches
 */
export function clearSharedCaches() {
  sharedConfigCache = null;
  sharedActivePathsCache = null;
  sharedPathConstantsCache.clear();
  sharedColorCache.clear();
  sharedPrecomputedPathsCache = null;
}
