// Shared config cache for all animation instances
// Since all betspots use the same config, we can share the cache

let sharedConfigCache = null;
let sharedActivePathsCache = null;
let sharedPathConstantsCache = new Map();
let sharedColorCache = new Map();

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
  }
  return sharedConfigCache.cfg;
}

export function getSharedActivePaths(cfg) {
  if (!sharedActivePathsCache) {
    sharedActivePathsCache = (cfg.paths || []).filter((p) => p.enabled !== false);
  }
  return sharedActivePathsCache;
}

export function getSharedPathConstants(key, computeFn) {
  if (!sharedPathConstantsCache.has(key)) {
    sharedPathConstantsCache.set(key, computeFn());
  }
  return sharedPathConstantsCache.get(key);
}

export function getSharedColorCache(key, computeFn) {
  if (!sharedColorCache.has(key)) {
    sharedColorCache.set(key, computeFn());
  }
  return sharedColorCache.get(key);
}

export function clearSharedCaches() {
  sharedConfigCache = null;
  sharedActivePathsCache = null;
  sharedPathConstantsCache.clear();
  sharedColorCache.clear();
}

