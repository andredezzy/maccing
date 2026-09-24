/**
 * Checks that a listing's live images are the declared files, in the declared order.
 *
 * Usage: bun image-order.ts <declared file>... -- <live image URL or file>...
 *
 * Give the declared files in their listing order, and the live images in page
 * order (shpImageSources() prints their URLs). The other images in the
 * declared files' folders are candidates too, so a sibling photo uploaded by
 * mistake is named, not passed.
 *
 * Each image shrinks to 32×32 greyscale. Its distance to a file is the mean
 * absolute pixel difference, from 0 to 255. Prints one line per position: the
 * nearest file, its distance, and the distance to the next nearest file.
 * A position is "ok" only when the nearest file is the declared one and is at
 * most half as far as the next. Exits 1 on any other verdict, or when the
 * counts differ.
 *
 * Needs: Bun 1.4 or later, for Bun.Image. No packages.
 */

import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { inflateSync } from "node:zlib";

const SIDE = 32;

// The same pixels on every OS: the system backend resamples differently on macOS.
Bun.Image.backend = "bun";

const separator = process.argv.indexOf("--");
if (separator < 0) {
  console.error("Usage: bun image-order.ts <declared file>... -- <live image URL or file>...");
  process.exit(2);
}
const declared = process.argv.slice(2, separator).map((file) => resolve(file));
const live = process.argv.slice(separator + 1);
const siblings = [...new Set(declared.map((file) => dirname(file)))]
  .flatMap((folder) => readdirSync(folder).map((name) => join(folder, name)))
  .filter((file) => /\.(jpe?g|png|webp)$/i.test(file) && !declared.includes(file));
const candidates = [...declared, ...siblings];

/** Reads a local path, or downloads an http(s) URL. */
async function load(source: string): Promise<Uint8Array> {
  if (!/^https?:\/\//.test(source)) {
    return Bun.file(source).bytes();
  }
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`${source}: HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** The image as 32×32 luma values (ITU-R 601, as Pillow's "L" mode). */
async function thumbnail(source: string): Promise<Float64Array> {
  const png = await new Bun.Image(await load(source))
    .resize(SIDE, SIDE, { fit: "fill" })
    .png({ compressionLevel: 0 })
    .bytes();
  const { channels, pixels } = decodePng(png);
  const luma = new Float64Array(SIDE * SIDE);
  for (let i = 0; i < luma.length; i++) {
    const p = i * channels;
    luma[i] = channels < 3 ? pixels[p] : 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
  }
  return luma;
}

/**
 * Unpacks an 8-bit, non-interlaced PNG, the only kind Bun.Image writes here.
 * Bun.Image has no raw output, so its PNG is decoded by hand.
 */
function decodePng(png: Uint8Array): { channels: number; pixels: Uint8Array } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const bitDepth = png[24];
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[png[25]];
  if (bitDepth !== 8 || !channels || png[28] !== 0) {
    throw new Error(`unsupported PNG: bit depth ${bitDepth}, colour type ${png[25]}, interlace ${png[28]}`);
  }
  const chunks: Uint8Array[] = [];
  for (let at = 8; at < png.length; ) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    if (type === "IDAT") {
      chunks.push(png.subarray(at + 8, at + 8 + length));
    }
    at += 12 + length;
  }
  const data = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = data[y * (stride + 1)];
    const row = data.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      pixels[y * stride + x] = (row[x] + predict(filter, left, up, upLeft)) & 0xff;
    }
  }
  return { channels, pixels };
}

/** The PNG filter's prediction for one byte (PNG specification, section 9). */
function predict(filter: number, left: number, up: number, upLeft: number): number {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return (left + up) >> 1;
    case 4: {
      const estimate = left + up - upLeft;
      const toLeft = Math.abs(estimate - left);
      const toUp = Math.abs(estimate - up);
      const toUpLeft = Math.abs(estimate - upLeft);
      return toLeft <= toUp && toLeft <= toUpLeft ? left : toUp <= toUpLeft ? up : upLeft;
    }
    default:
      throw new Error(`unknown PNG filter ${filter}`);
  }
}

function distance(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum / a.length;
}

const candidateThumbs = await Promise.all(candidates.map(thumbnail));
const liveThumbs = await Promise.all(live.map(thumbnail));
const shown = (file: string) => file.slice(dirname(declared[0]).length + 1) || file;

let wrong = live.length !== declared.length;
if (wrong) {
  console.log(`count: ${live.length} live, ${declared.length} declared`);
}
for (const [position, thumb] of liveThumbs.entries()) {
  const [nearest, next] = candidates
    .map((file, index) => ({ file, distance: distance(thumb, candidateThumbs[index]) }))
    .sort((a, b) => a.distance - b.distance);
  const expected = declared[position];
  const verdict =
    nearest.file !== expected
      ? `WRONG, expected ${expected ? shown(expected) : "nothing"}`
      : next && nearest.distance > next.distance / 2
        ? "UNSURE, too close to the next file"
        : "ok";
  wrong ||= verdict !== "ok";
  console.log(
    `${position + 1}. ${shown(nearest.file)}  ${nearest.distance.toFixed(1)}  next ${next?.distance.toFixed(1) ?? "-"}  ${verdict}`,
  );
}
process.exit(wrong ? 1 : 0);
