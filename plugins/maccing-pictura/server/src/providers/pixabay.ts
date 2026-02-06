import {
  createStockProvider,
  type StockProviderSpec,
  type StockSearchParams,
  type StockSearchResult,
  type StockPhotoResult,
  type StockAttribution,
} from '../provider-spec/stock.js';

const BASE_URL = 'https://pixabay.com/api';

/**
 * Map generic orientation to Pixabay orientation parameter.
 * Pixabay uses: horizontal, vertical (not landscape/portrait)
 */
function mapOrientation(orientation?: string): string | undefined {
  if (!orientation) return undefined;
  if (orientation === 'landscape') return 'horizontal';
  if (orientation === 'portrait') return 'vertical';
  // squarish has no direct equivalent, omit it
  return undefined;
}

/**
 * Map generic size name to Pixabay response field
 */
function getUrlForSize(hit: Record<string, unknown>, size: string): string {
  const sizeMap: Record<string, string> = {
    small: 'previewURL',
    medium: 'webformatURL',
    large: 'largeImageURL',
    original: 'largeImageURL',
  };
  const key = sizeMap[size] || 'largeImageURL';
  return (hit[key] as string) || (hit.largeImageURL as string) || (hit.webformatURL as string);
}

const pixabaySpec: StockProviderSpec = {
  name: 'pixabay',

  async searchPhotos(
    params: StockSearchParams,
    config: Record<string, unknown>
  ): Promise<StockSearchResult> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('Pixabay API key is required');
    }

    const searchParams = new URLSearchParams({
      key: apiKey,
      q: params.query,
      page: String(params.page || 1),
      per_page: String(params.perPage || 10),
      image_type: 'photo',
    });

    const orientation = mapOrientation(params.orientation);
    if (orientation) {
      searchParams.set('orientation', orientation);
    }
    if (params.color) {
      searchParams.set('colors', params.color);
    }

    const response = await fetch(`${BASE_URL}/?${searchParams}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pixabay API error (${response.status}): ${errorText}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    const totalResults = data.totalHits || 0;
    const perPage = params.perPage || 10;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photos: StockPhotoResult[] = (data.hits || []).map((hit: any) => ({
      id: String(hit.id),
      provider: 'pixabay',
      description: hit.tags || '',
      photographer: hit.user || 'Unknown',
      photographerUrl: `https://pixabay.com/users/${hit.user_id || ''}`,
      sourceUrl: hit.pageURL || '',
      width: hit.imageWidth || 0,
      height: hit.imageHeight || 0,
      color: null,
      sizes: {
        preview: hit.previewURL || '',
        webformat: hit.webformatURL || '',
        large: hit.largeImageURL || '',
      },
      downloadUrl: hit.largeImageURL || '',
      license: 'Pixabay License',
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
      throw new Error('Pixabay API key is required');
    }

    // Fetch photo details by ID
    const response = await fetch(`${BASE_URL}/?key=${apiKey}&id=${photoId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch photo details: ${response.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    const hit = data.hits?.[0];

    if (!hit) {
      throw new Error(`Photo not found: ${photoId}`);
    }

    const downloadUrl = getUrlForSize(hit, size);

    // Download the actual image
    const imageResponse = await fetch(downloadUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const imageData = Buffer.from(arrayBuffer);

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';

    return {
      data: imageData,
      filename: `pixabay-${photoId}.${ext}`,
      mimeType: contentType,
      attribution: {
        provider: 'Pixabay',
        photographer: hit.user || 'Unknown',
        photographerUrl: `https://pixabay.com/users/${hit.user_id || ''}`,
        sourceUrl: hit.pageURL || '',
        license: 'Pixabay License',
        attributionRequired: false,
      },
    };
  },
};

export const pixabay = createStockProvider(pixabaySpec);
