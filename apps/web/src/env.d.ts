interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_CONSENT_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}