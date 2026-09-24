# Plain JS with JSDoc, no build step

Apps are plain JavaScript with JSDoc annotations and `// @ts-check`,
type-checked via `tsc --noEmit` against `@types/google-apps-script`, rather
than writing TypeScript and transpiling. GAS runs the files verbatim with no
bundler in the toolchain, so this keeps the code clasp pushes byte-for-byte
identical to the code in the repo — no build step to keep in sync, no
source maps needed to debug in the Apps Script editor.
