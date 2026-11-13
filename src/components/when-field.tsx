import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useClockStyle } from '@/hooks/use-clock-style';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { capAt, earliestAt, formatWhen, pickDateThenTime, timeNow } from '@/lib/when';

export interface WhenFieldProps {
  /** "When", "Went to sleep"… */
  label?: string;
  /** Epoch ms. */
  value: number;
  onChange: (ms: number) => void;
}

/** Said under the field when a later time was picked. */
export const CAPPED_NOTE = 'That time hasn’t come yet, so it’s set to now.';

/**
 * The date and time of an entry, e.g. "Today, 2:35 pm", as a filled field.
 * A tap opens the phone's date picker, then its time picker. Never later
 * than now, at most a year back.
 */
export function WhenField({ label = 'When', value, onChange }: WhenFieldProps) {
  const theme = useTheme();
  const clock = useClockStyle();
  /** The value set to now because a later time was picked; the note goes once the value is something else. */
  const [cappedAt, setCappedAt] = useState<number | null>(null);
  // iOS shows its picker in the page instead of a dialog.
  const [open, setOpen] = useState(false);
  const now = useNow();
  const text = formatWhen(value, now, clock);

  const set = (wanted: number) => {
    const t = timeNow();
    const at = capAt(wanted, t);
    setCappedAt(wanted > t ? at : null);
    onChange(at);
  };

  const pick = () => {
    if (Platform.OS !== 'android') {
      setOpen((o) => !o);
      return;
    }
    pickDateThenTime((options) => DateTimePickerAndroid.open(options), value, timeNow(), set);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ThemedText type="bodyLarge" style={styles.label}>
          {label}
        </ThemedText>
        <Pressable
          onPress={pick}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${text}`}
          accessibilityHint="Opens the date, then the time"
          android_ripple={{ color: theme.outlineVariant }}
          style={({ pressed }) => [
            styles.value,
            {
              backgroundColor: pressed ? theme.surfaceContainerHigh : theme.surfaceContainerHighest,
              borderBottomColor: theme.onSurfaceVariant,
            },
          ]}>
          <ThemedText type="bodyLarge" style={styles.valueText}>
            {text}
          </ThemedText>
          <Ionicons name="calendar-outline" size={20} color={theme.onSurfaceVariant} />
        </Pressable>
      </View>
      {open && Platform.OS === 'ios' ? (
        <>
          <DateTimePicker
            value={new Date(value)}
            mode="datetime"
            display="inline"
            minimumDate={new Date(earliestAt(now))}
            maximumDate={new Date(now)}
            onValueChange={(_event, date) => set(date.getTime())}
          />
          <Button variant="tonal" label="Done" onPress={() => setOpen(false)} />
        </>
      ) : null}
      {cappedAt !== null && cappedAt === value ? <Notice text={CAPPED_NOTE} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  // A long date or a large font puts the date on a line of its own instead of squeezing the label.
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: TouchTarget,
  },
  label: { flexShrink: 1 },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: Spacing.two,
    minHeight: TouchTarget,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three - 4,
    borderTopLeftRadius: Radius.xs,
    borderTopRightRadius: Radius.xs,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  valueText: { flexShrink: 1, fontVariant: ['tabular-nums'] },
});
