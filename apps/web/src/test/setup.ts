import '@testing-library/jest-dom/vitest'

Object.defineProperty(window, 'matchMedia', {
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
  writable: true,
})

class ResizeObserverStub {
  observe() {
    return undefined
  }

  unobserve() {
    return undefined
  }

  disconnect() {
    return undefined
  }
}

window.ResizeObserver = ResizeObserverStub

// jsdom has no layout: Mantine's Combobox scrolls the selected option into
// view when a Select opens with a value, which would otherwise throw.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined
}
