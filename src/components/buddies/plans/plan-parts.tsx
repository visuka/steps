/**
 * Parts of the Plan screen (T16e): the answer numbers and the lists of who
 * said what. Numbers and words only; theme roles, Spacing and TouchTarget.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ListRow, Surface } from '@/components/ui';
import { displayName } from '@/buddies/read';
import type { PlanInvitee } from '@/buddies/types';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Going · Can't make it · Waiting as three numbers with their words (Waiting left out for club plans). */
export function AnswerCounts({ cells }: { cells: { n: number; word: string }[] }) {
  const theme = useTheme();
  return (
    <Surface level={1} style={styles.counts}>
      {cells.map((c, i) => (
        <View
          key={c.word}
          accessible
          accessibilityLabel={`${c.n} ${c.word}`}
          style={[styles.cell, i ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.outlineVariant } : null]}>
          <ThemedText type="titleLarge" maxFontSizeMultiplier={1.3}>
            {String(c.n)}
          </ThemedText>
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" numberOfLines={2} style={styles.word} maxFontSizeMultiplier={1.3}>
            {c.word}
          </ThemedText>
        </View>
      ))}
    </Surface>
  );
}

/** One answer's people: a heading, then a row each (a buddy's row opens our chat). */
export function PeopleList({ title, people, onOpen }: { title: string; people: PlanInvitee[]; onOpen: (p: PlanInvitee) => void }) {
  if (!people.length) return null;
  return (
    <View style={styles.gap}>
      <ThemedText type="titleSmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
        {`${title} (${people.length})`}
      </ThemedText>
      <Surface level={1} style={[styles.list, styles.under]}>
        {people.map((p, i) => {
          const me = p.walker.relation === 'self';
          const buddy = p.walker.relation === 'buddy';
          return (
            <ListRow
              key={p.walker.pid}
              title={me ? 'You' : displayName(p.walker)}
              supporting={p.walker.name ? `@${p.walker.handle}` : undefined}
              chevron={buddy}
              onPress={buddy ? () => onOpen(p) : undefined}
              accessibilityHint={buddy ? 'Opens your chat' : undefined}
              last={i === people.length - 1}
            />
          );
        })}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  counts: { flexDirection: 'row', overflow: 'hidden' },
  cell: { flex: 1, minHeight: TouchTarget, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, paddingHorizontal: Spacing.two },
  word: { textAlign: 'center' },
  list: { overflow: 'hidden' },
  gap: { marginTop: Spacing.four },
  under: { marginTop: Spacing.two },
});
