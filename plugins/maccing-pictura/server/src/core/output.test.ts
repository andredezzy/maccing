import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OutputManager, BatchInfo } from './output';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { ImageResult } from '../provider-spec/factory';

describe('OutputManager', () => {
  let tempDir: string;
  let manager: OutputManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pictura-output-test-'));
    manager = new OutputManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should store base directory', () => {
      expect(manager.getBaseDir()).toBe(tempDir);
    });
  });

  describe('saveImage', () => {
    it('should save image to correct path', async () => {
      const image: ImageResult = {
        data: Buffer.from('test-image-data'),
        ratio: '16:9',
        width: 1920,
        height: 1080,
        provider: 'test',
        model: 'test-model',
      };

      const savedPath = await manager.saveImage(image, 'test-slug', '2024-01-15-120000');

      expect(savedPath).toBe(path.join(tempDir, '2024-01-15-120000', 'test-slug', '16x9.png'));
      const content = await fs.readFile(savedPath);
      expect(content.toString()).toBe('test-image-data');
    });

    it('should create nested directories', async () => {
      const image: ImageResult = {
        data: Buffer.from('data'),
        ratio: '1:1',
        width: 1024,
        height: 1024,
        provider: 'test',
        model: 'test-model',
      };

      await manager.saveImage(image, 'nested-test', '2024-02-20-153045');

      const dir = path.join(tempDir, '2024-02-20-153045', 'nested-test');
      const stat = await fs.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should handle different ratios', async () => {
      const ratios = ['1:1', '9:16', '4:3', '21:9'] as const;

      for (const ratio of ratios) {
        const image: ImageResult = {
          data: Buffer.from(`data-${ratio}`),
          ratio,
          width: 1024,
          height: 1024,
          provider: 'test',
          model: 'test-model',
        };

        const savedPath = await manager.saveImage(image, 'ratio-test', '2024-01-01-000000');
        const expectedFilename = ratio.replace(':', 'x') + '.png';
        expect(savedPath).toContain(expectedFilename);
      }
    });
  });

  describe('saveBatch', () => {
    it('should save multiple images', async () => {
      const images: ImageResult[] = [
        {
          data: Buffer.from('image1'),
          ratio: '16:9',
          width: 1920,
          height: 1080,
          provider: 'test',
          model: 'test-model',
        },
        {
          data: Buffer.from('image2'),
          ratio: '1:1',
          width: 1024,
          height: 1024,
          provider: 'test',
          model: 'test-model',
        },
      ];

      const paths = await manager.saveBatch(images, 'batch-test', '2024-03-10-090000');

      expect(paths).toHaveLength(2);
      expect(paths[0]).toContain('16x9.png');
      expect(paths[1]).toContain('1x1.png');

      // Verify files exist
      for (const savedPath of paths) {
        const stat = await fs.stat(savedPath);
        expect(stat.isFile()).toBe(true);
      }
    });

    it('should handle empty batch', async () => {
      const paths = await manager.saveBatch([], 'empty-batch', '2024-01-01-000000');
      expect(paths).toHaveLength(0);
    });
  });

  describe('listBatches', () => {
    it('should return empty array for non-existent directory', async () => {
      const emptyManager = new OutputManager(path.join(tempDir, 'nonexistent'));
      const batches = await emptyManager.listBatches();
      expect(batches).toEqual([]);
    });

    it('should list saved batches', async () => {
      // Create test batches
      const image: ImageResult = {
        data: Buffer.from('test'),
        ratio: '16:9',
        width: 1920,
        height: 1080,
        provider: 'test',
        model: 'test-model',
      };

      await manager.saveImage(image, 'batch-one', '2024-01-01-100000');
      await manager.saveImage(image, 'batch-two', '2024-01-02-100000');

      const batches = await manager.listBatches();

      expect(batches).toHaveLength(2);
      // Should be sorted newest first
      expect(batches[0].timestamp).toBe('2024-01-02-100000');
      expect(batches[1].timestamp).toBe('2024-01-01-100000');
    });

    it('should respect limit parameter', async () => {
      const image: ImageResult = {
        data: Buffer.from('test'),
        ratio: '16:9',
        width: 1920,
        height: 1080,
        provider: 'test',
        model: 'test-model',
      };

      await manager.saveImage(image, 'batch1', '2024-01-01-100000');
      await manager.saveImage(image, 'batch2', '2024-01-02-100000');
      await manager.saveImage(image, 'batch3', '2024-01-03-100000');

      const batches = await manager.listBatches(2);
      expect(batches).toHaveLength(2);
    });

    it('should include image metadata', async () => {
      const images: ImageResult[] = [
        {
          data: Buffer.from('img1'),
          ratio: '16:9',
          width: 1920,
          height: 1080,
          provider: 'test',
          model: 'test-model',
        },
        {
          data: Buffer.from('img2'),
          ratio: '1:1',
          width: 1024,
          height: 1024,
          provider: 'test',
          model: 'test-model',
        },
      ];

      await manager.saveBatch(images, 'multi-image', '2024-05-15-143000');

      const batches = await manager.listBatches();
      expect(batches).toHaveLength(1);
      expect(batches[0].images).toHaveLength(2);
      expect(batches[0].images.some((i) => i.ratio === '16:9')).toBe(true);
      expect(batches[0].images.some((i) => i.ratio === '1:1')).toBe(true);
    });

    it('should filter out non-timestamp directories', async () => {
      // Create a valid batch
      const image: ImageResult = {
        data: Buffer.from('test'),
        ratio: '16:9',
        width: 1920,
        height: 1080,
        provider: 'test',
        model: 'test-model',
      };
      await manager.saveImage(image, 'valid', '2024-01-01-100000');

      // Create an invalid directory that doesn't match timestamp format
      await fs.mkdir(path.join(tempDir, 'invalid-dir'), { recursive: true });

      const batches = await manager.listBatches();
      expect(batches).toHaveLength(1);
      expect(batches[0].timestamp).toBe('2024-01-01-100000');
    });
  });

  describe('loadBatch', () => {
    it('should find batch by slug', async () => {
      const image: ImageResult = {
        data: Buffer.from('test'),
        ratio: '16:9',
        width: 1920,
        height: 1080,
        provider: 'test',
        model: 'test-model',
      };

      await manager.saveImage(image, 'find-me', '2024-06-01-120000');

      const batch = await manager.loadBatch('find-me');
      expect(batch).not.toBeNull();
      expect(batch!.slug).toBe('find-me');
      expect(batch!.timestamp).toBe('2024-06-01-120000');
    });

    it('should return null for non-existent slug', async () => {
      const batch = await manager.loadBatch('nonexistent');
      expect(batch).toBeNull();
    });
  });

  describe('deleteBatch', () => {
    it('should delete existing batch', async () => {
      const image: ImageResult = {
        data: Buffer.from('delete-me'),
        ratio: '16:9',
        width: 1920,
        height: 1080,
        provider: 'test',
        model: 'test-model',
      };

      await manager.saveImage(image, 'to-delete', '2024-07-01-100000');

      const deleted = await manager.deleteBatch('2024-07-01-100000', 'to-delete');
      expect(deleted).toBe(true);

      // Verify batch no longer exists
      const batch = await manager.loadBatch('to-delete');
      expect(batch).toBeNull();
    });

    it('should return false for non-existent batch', async () => {
      const deleted = await manager.deleteBatch('2024-01-01-000000', 'nonexistent');
      expect(deleted).toBe(false);
    });

    it('should clean up empty timestamp directory', async () => {
      const image: ImageResult = {
        data: Buffer.from('cleanup'),
        ratio: '16:9',
        width: 1920,
        height: 1080,
        provider: 'test',
        model: 'test-model',
      };

      await manager.saveImage(image, 'cleanup-test', '2024-08-01-100000');
      await manager.deleteBatch('2024-08-01-100000', 'cleanup-test');

      // Timestamp directory should be removed
      await expect(fs.stat(path.join(tempDir, '2024-08-01-100000'))).rejects.toThrow();
    });
  });

  describe('getImagePath', () => {
    it('should return correct path without saving', () => {
      const imagePath = manager.getImagePath('test-slug', '2024-01-01-000000', '16:9');
      expect(imagePath).toBe(
        path.join(tempDir, '2024-01-01-000000', 'test-slug', '16x9.png')
      );
    });

    it('should handle all supported ratios', () => {
      const ratios = ['1:1', '2:3', '3:2', '9:16', '21:9'] as const;
      for (const ratio of ratios) {
        const imagePath = manager.getImagePath('test', '2024-01-01-000000', ratio);
        expect(imagePath).toContain(ratio.replace(':', 'x') + '.png');
      }
    });
  });
});
