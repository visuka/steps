import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Notice } from '@/components/ui/notice';
import { Fonts, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useClockStyle } from '@/hooks/use-clock-style';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { capAt, earliestAt, formatWhen, timeNow } from '@/lib/when';

import { CAPPED_NOTE, type WhenFieldProps } from './when-field';

const pad = (n: number) => String(n).padStart(2, '0');

/** "2025-11-11T20:00", what a datetime-local input takes, in local time. */
const toInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function fromInput(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(text);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime();
}

/** The web preview has no native picker: the browser's own date-and-time field, drawn as a filled field. */
export function WhenField({ label = 'When', value, onChange }: WhenFieldProps) {
  const theme = useTheme();
  const clock = useClockStyle();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  /** The value set to now because a later time was picked; the note goes once the value is something else. */
  const [cappedAt, setCappedAt] = useState<number | null>(null);
  const now = useNow();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ThemedText type="bodyLarge" style={styles.label}>
          {label}
        </ThemedText>
        <input
          type="datetime-local"
          aria-label={label}
          value={toInput(value)}
          min={toInput(earliestAt(now))}
          max={toInput(now)}
          onChange={(e) => {
            const wanted = fromInput(e.target.value);
            if (wanted === null) return;
            const t = timeNow();
            const at = capAt(wanted, t);
            setCappedAt(wanted > t ? at : null);
            onChange(at);
          }}
          style={{
            fontFamily: Fonts.regular,
            fontSize: 16,
            minHeight: TouchTarget,
            boxSizing: 'border-box',
            color: theme.onSurface,
            backgroundColor: theme.surfaceContainerHighest,
            accentColor: theme.primary,
            colorScheme: scheme,
            border: 'none',
            borderBottom: `1px solid ${theme.onSurfaceVariant}`,
            borderRadius: `${Radius.xs}px ${Radius.xs}px 0 0`,
            padding: `${Spacing.two}px ${Spacing.three - 4}px`,
          }}
        />
      </View>
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
        {formatWhen(value, now, clock)}
      </ThemedText>
      {cappedAt !== null && cappedAt === value ? <Notice text={CAPPED_NOTE} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  label: { flexShrink: 1 },
});
