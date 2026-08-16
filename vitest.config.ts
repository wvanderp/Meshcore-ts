import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/index.ts',
                'src/connection/connection_types.ts',
            ],
            thresholds: {
                branches: 100,
                functions: 100,
                lines: 100,
                statements: 100,
            },
        },
    },
});
