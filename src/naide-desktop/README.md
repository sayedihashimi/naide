# Naide Desktop

A Tauri desktop application for non-pro developers to create and maintain apps using AI.

## Setup

### Prerequisites
- Node.js (v18 or later)
- npm

### Installation

```bash
# Navigate to the project directory
cd src/naide-desktop

# Install dependencies
npm install
```

### Running the Application

```bash
# Development mode (uses rolldown-vite for performance)
npm run dev

# Development mode with Tauri
npm run tauri:dev

# Build for production
npm run build

# Build Tauri app
npm run tauri:build
```

### Testing

```bash
# Run tests in watch mode
npm test

# Run tests once
npm test -- --run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

**Note**: If you see `ReferenceError: __vite_ssr_exportName__ is not defined`, you need to reinstall dependencies. See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for details.

### Dual Vite Configuration

This project uses two Vite implementations:
- **rolldown-vite** for development and builds (performance benefits)
- **Standard vite** for testing (Vitest compatibility)

This allows us to benefit from rolldown-vite's performance while maintaining full test compatibility.

## Project Structure

```
src/naide-desktop/
├── src/              # React source code
│   ├── components/   # React components
│   ├── pages/        # Page components
│   ├── context/      # React context providers
│   ├── utils/        # Utility functions
│   └── test/         # Test setup and integration tests
├── src-tauri/        # Tauri Rust backend
├── public/           # Static assets
└── dist/             # Build output
```

## Documentation

- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Solutions for common issues
- [Test Documentation](../../.prompts/tech/testing.md) - Testing infrastructure details
- [Project Requirements](../../.prompts/naide-prototype.overview.md) - Project specifications

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
