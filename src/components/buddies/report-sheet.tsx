import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { TextField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Button, ListRow, Sheet, ToggleRow } from '@/components/ui';
import { REPORT_REASONS, type ReportReason } from '@/buddies/types';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Report a walker or a message: a reason, an optional note, and "Also block". */
export function ReportSheet({
  visible,
  label,
  canBlock,
  onClose,
  onSend,
}: {
  visible: boolean;
  label: string;
  canBlock: boolean;
  onClose: () => void;
  onSend: (reason: ReportReason, note: string, alsoBlock: boolean) => void;
}) {
  const theme = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  return (
    <Sheet visible={visible} onClose={onClose} title={`Report ${label}`}>
      {REPORT_REASONS.map((r) => (
        <ListRow
          key={r.key}
          title={r.label}
          onPress={() => setReason(r.key)}
          trailing={reason === r.key ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : undefined}
          accessibilityLabel={`${r.label}${reason === r.key ? ', selected' : ''}`}
        />
      ))}
      <TextField label="Anything else? (optional)" value={note} onChangeText={setNote} placeholder="Anything else? (optional)" multiline maxLength={300} />
      {canBlock ? <ToggleRow title="Also block them" value={alsoBlock} onValueChange={setAlsoBlock} /> : null}
      <Button label="Send report" disabled={!reason} onPress={() => reason && onSend(reason, note.trim(), canBlock && alsoBlock)} style={styles.gap} />
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.gap} maxFontSizeMultiplier={1.3}>
        Steps reviews every report, urgent ones within 24 hours.
      </ThemedText>
    </Sheet>
  );
}

const styles = StyleSheet.create({ gap: { marginTop: Spacing.three } });
