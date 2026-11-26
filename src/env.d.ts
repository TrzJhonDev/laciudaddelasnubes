interface ImportMetaEnv {
  /** URL del PMTiles del mapa base en producción (R2). */
  readonly PUBLIC_BASEMAP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
