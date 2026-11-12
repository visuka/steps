import { requireOptionalNativeModule } from 'expo';

import { type BlockStoreNative, makeBlockStore } from './blockstore';

export {
  type BlockStoreApi,
  BlockStoreError,
  type BlockStoreErrorCode,
  isBlockStoreError,
  makeBlockStore,
} from './blockstore';

/** Android only; on iOS and the web preview it keeps nothing and finds nothing. */
export const BlockStore = makeBlockStore(requireOptionalNativeModule<BlockStoreNative>('BlockStore'));
