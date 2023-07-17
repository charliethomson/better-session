/// <reference types="vitest" />
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import * as path from "path";
import dts from "vite-plugin-dts";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [dts(), react()],
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "better-session",
            fileName: "better-session",
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: './src/react/__tests__/setup.ts'
    }
})
