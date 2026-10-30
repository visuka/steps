import type { Repository } from '@/data/types';

import type { StepSource } from './types';

/** Only Android's own counter publishes steps; elsewhere this is a no-op. */
export async function publishStepsIfOwnCounter(_repo: Repository, _source: StepSource, _now: Date): Promise<void> {}
