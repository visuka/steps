import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { IconCircle } from '@/components/ui/icon-circle';
import { ListRow } from '@/components/ui/list-row';
import { Sheet } from '@/components/ui/sheet';

import { ADD_LABEL, ADD_ROWS, type AddRowKey, addTarget, freshNonce } from './add-sheet-rows';

export interface AddSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Preview and tests: called instead of navigating. */
  onPick?: (key: AddRowKey) => void;
}

/**
 * The bottom bar's plus: a short sheet of what can be added (Sleep, Mood,
 * Weight, Blood pressure, Water) and Start walk. Closes on the scrim, Back
 * and any row. Food has its own tab, so it is not here.
 */
export function AddSheet({ visible, onClose, onPick }: AddSheetProps) {
  const router = useRouter();
  const pick = (key: AddRowKey) => {
    onClose();
    if (onPick) onPick(key);
    else router.navigate(addTarget(key, freshNonce()));
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={ADD_LABEL}>
      <View>
        {ADD_ROWS.map((row, i) => (
          <ListRow
            key={row.key}
            tall
            last={i === ADD_ROWS.length - 1}
            title={row.label}
            leading={<IconCircle name={row.icon} tone="accent" />}
            accessibilityLabel={row.accessibilityLabel}
            onPress={() => pick(row.key)}
          />
        ))}
      </View>
    </Sheet>
  );
}
