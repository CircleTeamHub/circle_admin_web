import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 10_000 });

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

globalThis.ResizeObserver = ResizeObserverMock;
