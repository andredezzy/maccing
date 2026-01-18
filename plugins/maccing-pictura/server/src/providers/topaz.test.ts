import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { topaz, TOPAZ_MODELS } from './topaz';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Topaz provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct provider name', () => {
    expect(topaz.name).toBe('topaz');
  });

  it('should expose expected models', () => {
    expect(TOPAZ_MODELS).toContain('Standard MAX');
    expect(TOPAZ_MODELS).toContain('Recovery V2');
    expect(TOPAZ_MODELS).toContain('High Fidelity V2');
  });

  it('should have correct max scale', () => {
    expect(topaz.maxScale).toBe(16);
  });

  it('should expose all 7 models', () => {
    expect(TOPAZ_MODELS).toHaveLength(7);
    expect(TOPAZ_MODELS).toContain('Standard V2');
    expect(TOPAZ_MODELS).toContain('Standard MAX');
    expect(TOPAZ_MODELS).toContain('Recovery V2');
    expect(TOPAZ_MODELS).toContain('High Fidelity V2');
    expect(TOPAZ_MODELS).toContain('Redefine');
    expect(TOPAZ_MODELS).toContain('Low Resolution V2');
    expect(TOPAZ_MODELS).toContain('CGI');
  });

  it('should have models array matching TOPAZ_MODELS', () => {
    expect(topaz.models).toEqual([...TOPAZ_MODELS]);
  });

  it('should have upscale function', () => {
    expect(typeof topaz.upscale).toBe('function');
  });

  it('should throw error when API key is missing', async () => {
    const params = { image: Buffer.from('test') };
    await expect(topaz.upscale(params, {})).rejects.toThrow(
      'Topaz API key is required'
    );
  });

  it('should submit job and poll for completion', async () => {
    const mockImageData = Buffer.from('upscaled-image-data');
    const processId = 'test-process-123';

    // Mock the submit job response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        process_id: processId,
        source_id: 'source-123',
        eta: Date.now() + 5000,
      }),
    });

    // Mock the poll response (completed on first try)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        state: 'completed',
        output_url: 'https://api.topazlabs.com/output/123.png',
        output_width: 2048,
        output_height: 1152,
        model: 'Standard V2',
      }),
    });

    // Mock the image download
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => mockImageData.buffer,
    });

    const params = { image: Buffer.from('test'), scale: 2 };
    const config = { apiKey: 'test-key' };

    const result = await topaz.upscale(params, config);

    expect(result.provider).toBe('topaz');
    expect(result.model).toBe('Standard V2');
    expect(result.width).toBe(2048);
    expect(result.height).toBe(1152);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should use specified model', async () => {
    const processId = 'test-process-456';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        process_id: processId,
        source_id: 'source-456',
        eta: Date.now() + 5000,
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        state: 'completed',
        output_url: 'https://api.topazlabs.com/output/456.png',
        output_width: 4096,
        output_height: 2304,
        model: 'High Fidelity V2',
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from('image').buffer,
    });

    const params = { image: Buffer.from('test'), model: 'High Fidelity V2' };
    const config = { apiKey: 'test-key' };

    const result = await topaz.upscale(params, config);

    expect(result.model).toBe('High Fidelity V2');
  });

  it('should handle API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad request',
    });

    const params = { image: Buffer.from('test') };
    const config = { apiKey: 'test-key' };

    await expect(topaz.upscale(params, config)).rejects.toThrow(
      'Topaz API error (400): Bad request'
    );
  });
});
