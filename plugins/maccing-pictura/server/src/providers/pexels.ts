import {
  createStockProvider,
  type StockProviderSpec,
  type StockSearchParams,
  type StockSearchResult,
  type StockPhotoResult,
  type StockAttribution,
} from '../provider-spec/stock.js';

const BASE_URL = 'https://api.pexels.com/v1';

/**
 * Map generic orientation to Pexels orientation parameter.
 * Pexels uses: landscape, portrait, square
 */
function mapOrientation(orientation?: string): string | undefined {
  if (!orientation) return undefined;
  if (orientation === 'squarish') return 'square';
  return orientation;
}

/**
 * Map generic size name to Pexels src key
 */
function getUrlForSize(src: Record<string, string>, size: string): string {
  const sizeMap: Record<string, string> = {
    small: 'small',
    medium: 'medium',
    large: 'large2x',
    original: 'original',
  };
  const key = sizeMap[size] || 'large';
  return src[key] || src.large || src.original;
}

const pexelsSpec: StockProviderSpec = {
  name: 'pexels',

  async searchPhotos(
    params: StockSearchParams,
    config: Record<string, unknown>
  ): Promise<StockSearchResult> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('Pexels API key is required');
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

    const response = await fetch(`${BASE_URL}/search?${searchParams}`, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pexels API error (${response.status}): ${errorText}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    const totalResults = data.total_results || 0;
    const perPage = params.perPage || 10;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photos: StockPhotoResult[] = (data.photos || []).map((photo: any) => ({
      id: String(photo.id),
      provider: 'pexels',
      description: photo.alt || '',
      photographer: photo.photographer || 'Unknown',
      photographerUrl: photo.photographer_url || '',
      sourceUrl: photo.url || '',
      width: photo.width,
      height: photo.height,
      color: photo.avg_color || null,
      sizes: {
        tiny: photo.src?.tiny || '',
        small: photo.src?.small || '',
        medium: photo.src?.medium || '',
        large: photo.src?.large || '',
        large2x: photo.src?.large2x || '',
        portrait: photo.src?.portrait || '',
        landscape: photo.src?.landscape || '',
        original: photo.src?.original || '',
      },
      downloadUrl: photo.src?.original || '',
      license: 'Pexels License',
      attributionRequired: false,
    }));

    return {
      photos,
      totalResults,
      page: params.page || 1,
      perPage,
      totalPages: Math.ceil(totalResults / perPage),
    };
  },

  async downloadPhoto(
    photoId: string,
    size: string,
    config: Record<string, unknown>
  ): Promise<{ data: Buffer; filename: string; mimeType: string; attribution: StockAttribution }> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('Pexels API key is required');
    }

    // Fetch photo details to get the source URLs
    const response = await fetch(`${BASE_URL}/photos/${photoId}`, {
      headers: { Authorization: apiKey },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch photo details: ${response.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photo: any = await response.json();
    const downloadUrl = getUrlForSize(photo.src || {}, size);

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
      filename: `pexels-${photoId}.${ext}`,
      mimeType: contentType,
      attribution: {
        provider: 'Pexels',
        photographer: photo.photographer || 'Unknown',
        photographerUrl: photo.photographer_url || '',
        sourceUrl: photo.url || '',
        license: 'Pexels License',
        attributionRequired: false,
      },
    };
  },
};

export const pexels = createStockProvider(pexelsSpec);
