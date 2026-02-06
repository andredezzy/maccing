import {
  createStockProvider,
  type StockProviderSpec,
  type StockSearchParams,
  type StockSearchResult,
  type StockPhotoResult,
  type StockAttribution,
} from '../provider-spec/stock.js';

const BASE_URL = 'https://api.unsplash.com';

// Cache download locations for tracking (required by Unsplash API Terms)
const downloadLocationCache = new Map<string, string>();

/**
 * Map Unsplash orientation param. Unsplash uses the same terminology.
 */
function mapOrientation(orientation?: string): string | undefined {
  if (!orientation) return undefined;
  // Unsplash supports: landscape, portrait, squarish
  return orientation;
}

/**
 * Map generic size name to Unsplash URL key
 */
function getUrlForSize(urls: Record<string, string>, size: string): string {
  const sizeMap: Record<string, string> = {
    small: 'small',
    medium: 'regular',
    large: 'full',
    original: 'raw',
  };
  const key = sizeMap[size] || 'regular';
  return urls[key] || urls.regular || urls.full;
}

const unsplashSpec: StockProviderSpec = {
  name: 'unsplash',

  async searchPhotos(
    params: StockSearchParams,
    config: Record<string, unknown>
  ): Promise<StockSearchResult> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('Unsplash API key is required');
    }

    const searchParams = new URLSearchParams({
      query: params.query,
      page: String(params.page || 1),
      per_page: String(params.perPage || 10),
    });

    const orientation = mapOrientation(params.orientation);
    if (orientation) {
      searchParams.set('orientation', orientation);
    }
    if (params.color) {
      searchParams.set('color', params.color);
    }

    const response = await fetch(`${BASE_URL}/search/photos?${searchParams}`, {
      headers: {
        Authorization: `Client-ID ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Unsplash API error (${response.status}): ${errorText}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photos: StockPhotoResult[] = data.results.map((photo: any) => {
      // Cache download location for tracking
      if (photo.links?.download_location) {
        downloadLocationCache.set(photo.id, photo.links.download_location);
      }

      return {
        id: photo.id,
        provider: 'unsplash',
        description: photo.description || photo.alt_description || '',
        photographer: photo.user?.name || 'Unknown',
        photographerUrl: photo.user?.links?.html || '',
        sourceUrl: photo.links?.html || '',
        width: photo.width,
        height: photo.height,
        color: photo.color || null,
        sizes: {
          thumb: photo.urls?.thumb || '',
          small: photo.urls?.small || '',
          regular: photo.urls?.regular || '',
          full: photo.urls?.full || '',
          raw: photo.urls?.raw || '',
        },
        downloadUrl: photo.urls?.full || '',
        license: 'Unsplash License',
        attributionRequired: true,
      };
    });

    return {
      photos,
      totalResults: data.total || 0,
      page: params.page || 1,
      perPage: params.perPage || 10,
      totalPages: data.total_pages || 0,
    };
  },

  async downloadPhoto(
    photoId: string,
    size: string,
    config: Record<string, unknown>
  ): Promise<{ data: Buffer; filename: string; mimeType: string; attribution: StockAttribution }> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('Unsplash API key is required');
    }

    // First, get the photo details to get the download URL
    const photoResponse = await fetch(`${BASE_URL}/photos/${photoId}`, {
      headers: { Authorization: `Client-ID ${apiKey}` },
    });

    if (!photoResponse.ok) {
      throw new Error(`Failed to fetch photo details: ${photoResponse.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photo: any = await photoResponse.json();

    // Cache download location for tracking
    if (photo.links?.download_location) {
      downloadLocationCache.set(photoId, photo.links.download_location);
    }

    const downloadUrl = getUrlForSize(photo.urls || {}, size);

    // Download the actual image
    const imageResponse = await fetch(downloadUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const data = Buffer.from(arrayBuffer);

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';

    return {
      data,
      filename: `unsplash-${photoId}.${ext}`,
      mimeType: contentType,
      attribution: {
        provider: 'Unsplash',
        photographer: photo.user?.name || 'Unknown',
        photographerUrl: photo.user?.links?.html || '',
        sourceUrl: photo.links?.html || '',
        license: 'Unsplash License',
        attributionRequired: true,
      },
    };
  },

  /**
   * Track download as required by Unsplash API Terms of Service.
   * Must call the download_location endpoint when a photo is downloaded.
   */
  async trackDownload(
    photoId: string,
    config: Record<string, unknown>
  ): Promise<void> {
    const apiKey = config.apiKey as string;
    if (!apiKey) return;

    // Use cached download location if available
    let downloadLocation = downloadLocationCache.get(photoId);

    if (!downloadLocation) {
      // Fallback: construct the download tracking URL
      downloadLocation = `${BASE_URL}/photos/${photoId}/download`;
    }

    await fetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${apiKey}` },
    });

    // Clean up cache entry
    downloadLocationCache.delete(photoId);
  },
};

export const unsplash = createStockProvider(unsplashSpec);
