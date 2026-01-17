/**
 * OutputManager: Handles saving, loading, and organizing generated images
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ratioToFilename, filenameToRatio } from '../utils/slug.js';
import type { ImageResult, SupportedRatio } from '../provider-spec/factory.js';

/**
 * Metadata for a batch of generated images
 */
export interface BatchInfo {
  timestamp: string;
  slug: string;
  path: string;
  images: Array<{ ratio: SupportedRatio; path: string }>;
}

/**
 * Manages saving and loading of generated images
 */
export class OutputManager {
  private baseDir: string;

  /**
   * Creates a new OutputManager
   * @param baseDir Base directory for storing images
   */
  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  /**
   * Returns the base output directory
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Saves a single image to disk
   * @param image The image result to save
   * @param slug The prompt-derived slug
   * @param timestamp The generation timestamp
   * @returns The absolute path where the image was saved
   */
  async saveImage(image: ImageResult, slug: string, timestamp: string): Promise<string> {
    const dir = path.join(this.baseDir, timestamp, slug);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${ratioToFilename(image.ratio)}.png`;
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, image.data);
    return filePath;
  }

  /**
   * Saves multiple images from a batch generation
   * @param images Array of image results to save
   * @param slug The prompt-derived slug
   * @param timestamp The generation timestamp
   * @returns Array of absolute paths where images were saved
   */
  async saveBatch(images: ImageResult[], slug: string, timestamp: string): Promise<string[]> {
    const paths: string[] = [];
    for (const image of images) {
      const savedPath = await this.saveImage(image, slug, timestamp);
      paths.push(savedPath);
    }
    return paths;
  }

  /**
   * Lists recent batches of generated images
   * @param limit Maximum number of batches to return (default: 10)
   * @returns Array of batch metadata, sorted by timestamp (newest first)
   */
  async listBatches(limit = 10): Promise<BatchInfo[]> {
    const batches: BatchInfo[] = [];

    try {
      // List timestamp directories
      const timestamps = await fs.readdir(this.baseDir);

      // Sort by timestamp (newest first)
      const sortedTimestamps = timestamps
        .filter((t) => /^\d{4}-\d{2}-\d{2}-\d{6}$/.test(t))
        .sort()
        .reverse();

      for (const timestamp of sortedTimestamps) {
        if (batches.length >= limit) break;

        const timestampDir = path.join(this.baseDir, timestamp);
        const stat = await fs.stat(timestampDir);
        if (!stat.isDirectory()) continue;

        // List slug directories within timestamp
        const slugs = await fs.readdir(timestampDir);

        for (const slug of slugs) {
          if (batches.length >= limit) break;

          const slugDir = path.join(timestampDir, slug);
          const slugStat = await fs.stat(slugDir);
          if (!slugStat.isDirectory()) continue;

          // List image files
          const files = await fs.readdir(slugDir);
          const images: Array<{ ratio: SupportedRatio; path: string }> = [];

          for (const file of files) {
            if (file.endsWith('.png')) {
              const ratioStr = filenameToRatio(file);
              images.push({
                ratio: ratioStr as SupportedRatio,
                path: path.join(slugDir, file),
              });
            }
          }

          if (images.length > 0) {
            batches.push({
              timestamp,
              slug,
              path: slugDir,
              images,
            });
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist yet, return empty array
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    return batches;
  }

  /**
   * Finds a batch by its slug
   * @param slug The slug to search for
   * @returns The batch info if found, null otherwise
   */
  async loadBatch(slug: string): Promise<BatchInfo | null> {
    const batches = await this.listBatches(100);
    return batches.find((b) => b.slug === slug) || null;
  }

  /**
   * Deletes a batch by timestamp and slug
   * @param timestamp The batch timestamp
   * @param slug The batch slug
   * @returns True if deleted, false if not found
   */
  async deleteBatch(timestamp: string, slug: string): Promise<boolean> {
    const batchDir = path.join(this.baseDir, timestamp, slug);
    try {
      await fs.rm(batchDir, { recursive: true, force: true });

      // Try to clean up empty timestamp directory
      const timestampDir = path.join(this.baseDir, timestamp);
      const remaining = await fs.readdir(timestampDir);
      if (remaining.length === 0) {
        await fs.rmdir(timestampDir);
      }

      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Gets the path where an image would be saved
   * @param slug The prompt-derived slug
   * @param timestamp The generation timestamp
   * @param ratio The image ratio
   * @returns The absolute path for the image
   */
  getImagePath(slug: string, timestamp: string, ratio: SupportedRatio): string {
    const filename = `${ratioToFilename(ratio)}.png`;
    return path.join(this.baseDir, timestamp, slug, filename);
  }
}
