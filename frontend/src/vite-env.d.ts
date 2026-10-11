/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_USE_MOCK?: string;
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_ATTRIBUTION?: string;
  readonly VITE_DIRECTIONS_PROVIDER?: string;
  /** Only for src/e2e.contract.test.ts: URL of a running backend to test against. */
  readonly VITE_E2E_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
