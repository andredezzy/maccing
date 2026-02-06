import type {
  StockProviderFunction,
  StockSearchParams,
  StockSearchResult,
  StockPhotoResult,
  StockAttribution,
} from './provider-spec/stock.js';

// ============================================================================
// Stock Provider Registry
// ============================================================================

const stockProviderRegistry = new Map<string, StockProviderFunction>();

export function registerStockProvider(provider: StockProviderFunction): void {
  stockProviderRegistry.set(provider.name, provider);
}

export function getStockProvider(name: string): StockProviderFunction | undefined {
  return stockProviderRegistry.get(name);
}

export function clearStockProviderRegistry(): void {
  stockProviderRegistry.clear();
}

export function getRegisteredStockProviders(): string[] {
  return Array.from(stockProviderRegistry.keys());
}

// ============================================================================
// Search Orchestrator
// ============================================================================

export interface SearchStockOptions {
  query: string;
  provider: string;
  page?: number;
  perPage?: number;
  orientation?: 'landscape' | 'portrait' | 'squarish';
  color?: string;
  configs: Record<string, Record<string, unknown>>;
}

/**
 * Search stock photos. When provider is 'all', searches all registered
 * providers in parallel and merges results interleaved by provider.
 */
export async function searchStock(options: SearchStockOptions): Promise<StockSearchResult> {
  const { query, provider, page = 1, perPage = 10, orientation, color, configs } = options;

  const params: StockSearchParams = { query, page, perPage, orientation, color };

  if (provider === 'all') {
    return searchAllProviders(params, configs);
  }

  const stockProvider = stockProviderRegistry.get(provider);
  if (!stockProvider) {
    throw new Error(`Stock provider not registered: ${provider}`);
  }

  const config = configs[provider] || {};
  return stockProvider.searchPhotos(params, config);
}

/**
 * Search all registered providers in parallel, merge results interleaved
 */
async function searchAllProviders(
  params: StockSearchParams,
  configs: Record<string, Record<string, unknown>>
): Promise<StockSearchResult> {
  const providers = Array.from(stockProviderRegistry.entries());

  // Only search providers that have config (API keys)
  const configuredProviders = providers.filter(([name]) => {
    const config = configs[name];
    return config && (config as Record<string, unknown>).apiKey;
  });

  if (configuredProviders.length === 0) {
    throw new Error('No stock providers configured with API keys');
  }

  const results = await Promise.allSettled(
    configuredProviders.map(([name, provider]) =>
      provider.searchPhotos(params, configs[name] || {})
    )
  );

  // Collect successful results
  const successResults: StockSearchResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      successResults.push(result.value);
    }
  }

  if (successResults.length === 0) {
    throw new Error('All stock provider searches failed');
  }

  // Interleave photos from different providers
  const merged = interleavePhotos(successResults.map(r => r.photos));
  const totalResults = successResults.reduce((sum, r) => sum + r.totalResults, 0);

  return {
    photos: merged,
    totalResults,
    page: params.page || 1,
    perPage: params.perPage || 10,
    totalPages: Math.ceil(totalResults / (params.perPage || 10)),
  };
}

/**
 * Interleave arrays of photos from different providers in round-robin order
 */
function interleavePhotos(photoArrays: StockPhotoResult[][]): StockPhotoResult[] {
  const result: StockPhotoResult[] = [];
  const maxLength = Math.max(...photoArrays.map(a => a.length));

  for (let i = 0; i < maxLength; i++) {
    for (const photos of photoArrays) {
      if (i < photos.length) {
        result.push(photos[i]);
      }
    }
  }

  return result;
}

// ============================================================================
// Download Orchestrator
// ============================================================================

export interface DownloadStockOptions {
  provider: string;
  photoId: string;
  size?: string;
  config: Record<string, unknown>;
}

/**
 * Download a stock photo and trigger download tracking if required by the provider
 */
export async function downloadStock(
  options: DownloadStockOptions
): Promise<{ data: Buffer; filename: string; mimeType: string; attribution: StockAttribution }> {
  const { provider: providerName, photoId, size = 'large', config } = options;

  const provider = stockProviderRegistry.get(providerName);
  if (!provider) {
    throw new Error(`Stock provider not registered: ${providerName}`);
  }

  // Download the photo
  const result = await provider.downloadPhoto(photoId, size, config);

  // Track the download if required (e.g., Unsplash API terms)
  if (provider.trackDownload) {
    try {
      await provider.trackDownload(photoId, config);
    } catch {
      // Non-fatal: download tracking failure should not block the user
    }
  }

  return result;
}
