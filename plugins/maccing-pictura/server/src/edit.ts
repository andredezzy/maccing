import {
  type ModelSelector,
  type ModelWithFallbacks,
  type EditImageParams,
  type ImageResult,
} from './provider-spec/factory.js';
import { getProvider } from './generate.js';

export type EditOperation = 'refine' | 'inpaint' | 'outpaint' | 'restyle';

export interface EditImageOptions {
  model: ModelWithFallbacks;
  image: Buffer;
  prompt: string;
  operation: EditOperation;
  mask?: string;
  direction?: 'top' | 'bottom' | 'left' | 'right';
  styleRef?: Buffer;
  config: Record<string, unknown>;
}

/**
 * Edit an image using the specified model or fallback chain.
 */
export async function editImage(options: EditImageOptions): Promise<ImageResult> {
  const { model, image, prompt, operation, mask, direction, styleRef, config } = options;

  const models = Array.isArray(model) ? model : [model];
  const errors: Error[] = [];

  for (const modelSelector of models) {
    try {
      const provider = getProvider(modelSelector.provider);

      if (!provider) {
        throw new Error(`Provider not registered: ${modelSelector.provider}`);
      }

      if (!provider.editImage) {
        throw new Error(`Provider ${modelSelector.provider} does not support edit operations`);
      }

      // Build edit params based on operation type
      const editParams: EditImageParams = {
        image,
        prompt: buildEditPrompt(prompt, operation, mask),
        mask: operation === 'inpaint' ? mask : undefined,
        extend: operation === 'outpaint' ? direction : undefined,
        style: operation === 'restyle' ? styleRef : undefined,
      };

      const result = await provider.editImage(modelSelector.modelId, editParams, config);
      return result;
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      continue;
    }
  }

  throw new Error(`All providers failed: ${errors.map((e) => e.message).join(', ')}`);
}

/**
 * Build the edit prompt based on operation type.
 */
function buildEditPrompt(prompt: string, operation: EditOperation, mask?: string): string {
  switch (operation) {
    case 'inpaint':
      return mask
        ? `In the image, modify only the ${mask}: ${prompt}`
        : prompt;
    case 'outpaint':
      return `Extend the image: ${prompt}`;
    case 'restyle':
      return `Apply style to image: ${prompt}`;
    case 'refine':
    default:
      return prompt;
  }
}
