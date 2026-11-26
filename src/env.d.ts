interface ImportMetaEnv {
  /** URL base (sin barra final) donde están continente.pmtiles y amazonas.pmtiles (R2). */
  readonly PUBLIC_TILES_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
