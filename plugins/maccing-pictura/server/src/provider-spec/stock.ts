// ============================================================================
// Stock Provider Types and Factory
// ============================================================================

// ============================================================================
// Stock Photo Types
// ============================================================================

export interface StockPhotoResult {
  id: string;
  provider: string;
  description: string;
  photographer: string;
  photographerUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
  color: string | null;
  sizes: Record<string, string>;
  downloadUrl: string;
  license: string;
  attributionRequired: boolean;
}

export interface StockSearchParams {
  query: string;
  page?: number;
  perPage?: number;
  orientation?: 'landscape' | 'portrait' | 'squarish';
  color?: string;
}

export interface StockSearchResult {
  photos: StockPhotoResult[];
  totalResults: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface StockAttribution {
  provider: string;
  photographer: string;
  photographerUrl: string;
  sourceUrl: string;
  license: string;
  attributionRequired: boolean;
}

// ============================================================================
// Stock Provider Spec
// ============================================================================

export interface StockProviderSpec {
  name: string;
  searchPhotos(
    params: StockSearchParams,
    config: Record<string, unknown>
  ): Promise<StockSearchResult>;
  downloadPhoto(
    photoId: string,
    size: string,
    config: Record<string, unknown>
  ): Promise<{ data: Buffer; filename: string; mimeType: string; attribution: StockAttribution }>;
  trackDownload?(
    photoId: string,
    config: Record<string, unknown>
  ): Promise<void>;
}

// ============================================================================
// Stock Provider Function (created by factory)
// ============================================================================

export interface StockProviderFunction {
  name: string;
  spec: StockProviderSpec;
  searchPhotos(
    params: StockSearchParams,
    config: Record<string, unknown>
  ): Promise<StockSearchResult>;
  downloadPhoto(
    photoId: string,
    size: string,
    config: Record<string, unknown>
  ): Promise<{ data: Buffer; filename: string; mimeType: string; attribution: StockAttribution }>;
  trackDownload?(
    photoId: string,
    config: Record<string, unknown>
  ): Promise<void>;
}

// ============================================================================
// Factory
// ============================================================================

export function createStockProvider(spec: StockProviderSpec): StockProviderFunction {
  return {
    name: spec.name,
    spec,
    searchPhotos: (params, config) => spec.searchPhotos(params, config),
    downloadPhoto: (photoId, size, config) => spec.downloadPhoto(photoId, size, config),
    trackDownload: spec.trackDownload
      ? (photoId, config) => spec.trackDownload!(photoId, config)
      : undefined,
  };
}
