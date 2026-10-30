import type { Repository } from '@/data/types';

/** Only the web preview gets sample moods, weather and walks (see seed-preview.web.ts). */
export async function seedPreview(_repo: Repository): Promise<void> {}
