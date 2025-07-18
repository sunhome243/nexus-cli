import '@testing-library/jest-dom/vitest'
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './mocks/server.js'

// Setup MSW
beforeAll(() => server.listen())
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())

// Global test environment setup
beforeEach(() => {
  // Reset any global state
  if (typeof vi !== 'undefined') {
    vi.clearAllMocks()
  }
})