export const STORAGE_KEY = "poster-editor-project";

export function saveProject(json: any) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
  } catch {}
}

export function loadProject(): any | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearProject() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}