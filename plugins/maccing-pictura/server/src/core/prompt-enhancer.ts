// ============================================================================
// Prompt Enhancer: Automatic style detection and prompt enhancement
// ============================================================================

/**
 * Style types supported by the prompt enhancer
 */
export type StyleType = 'photo' | 'art' | 'commercial' | 'auto' | 'minimal';

/**
 * Style profile definition with modifiers, technical settings, and lighting
 */
export interface StyleProfile {
  modifiers: string[];
  technical: string[];
  lighting: string[];
}

/**
 * Options for prompt enhancement
 */
export interface EnhanceOptions {
  style: StyleType;
}

// ============================================================================
// Style Profiles: predefined enhancement modifiers per style
// ============================================================================

export const STYLE_PROFILES: Record<'photo' | 'art' | 'commercial', StyleProfile> = {
  photo: {
    modifiers: ['realistic', 'high detail', 'photorealistic'],
    technical: ['85mm lens', 'shallow depth of field', 'sharp focus'],
    lighting: ['golden hour', 'natural lighting', 'soft shadows'],
  },
  art: {
    modifiers: ['stylized', 'vibrant colors', 'artistic interpretation'],
    technical: ['cel-shading', 'clean lines', 'dynamic composition'],
    lighting: ['dramatic lighting', 'ambient glow', 'color contrast'],
  },
  commercial: {
    modifiers: ['professional', 'product photography', 'studio quality'],
    technical: ['high resolution', 'clean background', 'commercial grade'],
    lighting: ['studio lighting', 'soft box', 'even illumination'],
  },
};

// ============================================================================
// Generic enhancement for auto mode when no style is detected
// ============================================================================

const GENERIC_ENHANCEMENT: StyleProfile = {
  modifiers: ['high quality', 'detailed'],
  technical: ['sharp focus', 'well composed'],
  lighting: ['balanced lighting'],
};

// ============================================================================
// Style Detection Keywords
// ============================================================================

const STYLE_KEYWORDS: Record<'photo' | 'art' | 'commercial', string[]> = {
  photo: [
    'photo',
    'photograph',
    'realistic',
    'portrait',
    'snapshot',
    'camera',
    'lens',
    'photography',
    'photorealistic',
    'lifelike',
  ],
  art: [
    'cartoon',
    'anime',
    'illustration',
    'drawing',
    'painting',
    'sketch',
    'comic',
    'manga',
    'watercolor',
    'oil painting',
    'digital art',
    'concept art',
    'stylized',
    'artistic',
  ],
  commercial: [
    'product',
    'advertisement',
    'marketing',
    'studio',
    'commercial',
    'catalog',
    'e-commerce',
    'product shot',
    'packshot',
    'promotional',
  ],
};

// ============================================================================
// Style Detection Function
// ============================================================================

/**
 * Detect the style of a prompt based on keyword analysis.
 * Returns 'auto' if no specific style is detected.
 *
 * @param prompt The prompt to analyze
 * @returns Detected style type ('photo', 'art', 'commercial', or 'auto')
 */
export function detectStyle(prompt: string): StyleType {
  const lowerPrompt = prompt.toLowerCase();

  // Check each style's keywords
  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS) as [
    'photo' | 'art' | 'commercial',
    string[],
  ][]) {
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword)) {
        return style;
      }
    }
  }

  return 'auto';
}

// ============================================================================
// Prompt Enhancer Class
// ============================================================================

/**
 * PromptEnhancer adds style-specific modifiers to prompts for better image generation.
 *
 * Supports multiple modes:
 * - photo: realistic photography enhancements
 * - art: artistic and stylized enhancements
 * - commercial: product and studio photography enhancements
 * - auto: auto-detect style from prompt keywords
 * - minimal: return prompt unchanged
 */
export class PromptEnhancer {
  /**
   * Enhance a prompt with style-specific modifiers.
   *
   * @param prompt The original prompt
   * @param options Enhancement options including style
   * @returns Enhanced prompt string
   */
  enhance(prompt: string, options: EnhanceOptions): string {
    const { style } = options;

    // Minimal mode returns the prompt unchanged
    if (style === 'minimal') {
      return prompt;
    }

    // Determine which profile to use
    let profile: StyleProfile;

    if (style === 'auto') {
      const detectedStyle = detectStyle(prompt);
      if (detectedStyle === 'auto') {
        // No style detected, use generic enhancement
        profile = GENERIC_ENHANCEMENT;
      } else {
        profile = STYLE_PROFILES[detectedStyle];
      }
    } else {
      // style is now narrowed to 'photo' | 'art' | 'commercial'
      profile = STYLE_PROFILES[style as 'photo' | 'art' | 'commercial'];
    }

    // Build enhanced prompt
    return this.buildEnhancedPrompt(prompt, profile);
  }

  /**
   * Build the enhanced prompt by combining the original with style modifiers.
   *
   * @param prompt Original prompt
   * @param profile Style profile to apply
   * @returns Enhanced prompt string
   */
  private buildEnhancedPrompt(prompt: string, profile: StyleProfile): string {
    const parts: string[] = [prompt];

    // Add style modifiers
    if (profile.modifiers.length > 0) {
      parts.push(profile.modifiers.join(', '));
    }

    // Add technical settings
    if (profile.technical.length > 0) {
      parts.push(profile.technical.join(', '));
    }

    // Add lighting
    if (profile.lighting.length > 0) {
      parts.push(profile.lighting.join(', '));
    }

    return parts.join(', ');
  }
}
