import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.git'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        'src/infrastructure/di/',
        'dist/',
        '.git/',
        'coverage/',
        '**/*.config.{ts,js}',
        '**/index.ts', // Re-export files
        '**/*.types.ts', // Type definition files
      ],
      include: ['src/**/*.{ts,tsx}'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Specific thresholds for critical components
        'src/services/sync/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/services/session/**': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
      // File-specific coverage requirements
      perFile: true,
      watermarks: {
        statements: [70, 85],
        functions: [70, 85],
        branches: [70, 85],
        lines: [70, 85],
      },
    },
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: false
      }
    },
    sequence: {
      concurrent: true
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})