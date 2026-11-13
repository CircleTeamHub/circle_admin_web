import '@testing-library/jest-dom/vitest';
import { act, configure } from '@testing-library/react';
import { Modal, message } from 'antd';
import { afterEach } from 'vitest';

configure({ asyncUtilTimeout: 10_000 });

// antd's static message and Modal.confirm render outside the tree RTL unmounts, so
// their close timers outlive the test and can fire after this file's jsdom is torn
// down: "window is not defined", blamed on whichever file the worker runs next.
afterEach(async () => {
  await act(async () => {
    message.destroy();
    Modal.destroyAll();
  });
});

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
