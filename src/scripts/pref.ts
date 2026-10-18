// localStorage for the reader's small choices (family mode, theme). Every read and write is inside try/catch:
// with the storage blocked a choice still works on this page, it is just not remembered.
export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts until the page is left.
  }
}
