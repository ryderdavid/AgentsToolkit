import '@testing-library/jest-dom/vitest';

// Ensure localStorage is available in test env (jsdom sometimes absent when misconfigured)
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.clear !== 'function') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: key => (store.has(key) ? store.get(key)! : null),
    key: index => Array.from(store.keys())[index] ?? null,
    removeItem: key => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
  } as unknown as Storage;
}
