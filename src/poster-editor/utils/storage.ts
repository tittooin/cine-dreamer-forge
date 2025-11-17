// LocalStorage helpers for Phase 2
// Keys:
// - tittoos_assets: user uploaded assets
// - tittoos_templates: local template copies
// - tittoos_recent_projects: autosaves

export type StorageKey = 'tittoos_assets' | 'tittoos_templates' | 'tittoos_recent_projects' | string;

const STORAGE_KEYS = {
  assets: 'tittoos_assets',
  templates: 'tittoos_templates',
  recent: 'tittoos_recent_projects',
} as const;

export const keys = STORAGE_KEYS;

export function loadJSON<T = any>(key: StorageKey, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function saveJSON<T = any>(key: StorageKey, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function clearKey(key: StorageKey) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// Convenience wrappers
export function getAssets<T = any[]>(defaultValue: T = [] as unknown as T) {
  return loadJSON<T>(STORAGE_KEYS.assets, defaultValue);
}

export function saveAssets<T = any[]>(assets: T) {
  saveJSON<T>(STORAGE_KEYS.assets, assets);
}

export function getTemplates<T = any[]>(defaultValue: T = [] as unknown as T) {
  return loadJSON<T>(STORAGE_KEYS.templates, defaultValue);
}

export function saveTemplates<T = any[]>(templates: T) {
  saveJSON<T>(STORAGE_KEYS.templates, templates);
}

export function getRecentProjects<T = any[]>(defaultValue: T = [] as unknown as T) {
  return loadJSON<T>(STORAGE_KEYS.recent, defaultValue);
}

export function saveRecentProjects<T = any[]>(projects: T) {
  saveJSON<T>(STORAGE_KEYS.recent, projects);
}

export function setActiveTemplateName(name: string | null) {
  try { localStorage.setItem('tittoos_active_template', name ?? ''); } catch {}
}

export function getActiveTemplateName(): string | null {
  try {
    const v = localStorage.getItem('tittoos_active_template');
    return v && v.length ? v : null;
  } catch { return null; }
}