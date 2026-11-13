import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, TickBar } from '@/components/ui';
import { NumeralMaxScale, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatWater } from '@/lib/format';
import { useApp } from '@/state/app-state';
import type { AddedGlass, WaterHook } from '@/state/use-water';

import { WaterSheet } from './food-settings';

/**
 * Today's water: glasses against the target, the fill on a water-blue bar,
 * +1 glass, and the target's own line. With a doctor's limit it is a neutral
 * "of 1.5 L limit", never "Target reached".
 */
export function WaterBody({ water, onAdded }: { water: WaterHook; onAdded: (a: AddedGlass | null) => void }) {
  const { profile } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const s = water.status;
  const units = profile.units;
  const glassMl = profile.water.glassMl;
  const total = s ? s.waterMl + s.drinksMl : 0;
  const target = s?.target ?? null;
  const p = s?.progress ?? null;
  const glasses = p?.glasses ?? Math.floor(total / glassMl);
  const limit = target?.limit ?? false;
  // A doctor's limit is a ceiling, not a goal: never "of 6 glasses".
  const glassesOf = p && !limit ? p.glassesTarget : null;
  const glassWord = glasses === 1 ? 'glass' : 'glasses';

  return (
    <>
      <View style={styles.top}>
        <View style={styles.grow} accessible accessibilityLabel={`${glasses} ${glassWord}${glassesOf !== null ? ` of ${glassesOf}` : ''}. ${s?.progressText ?? ''}`}>
          <View style={styles.numberRow}>
            <ThemedText type="numeralLarge" maxFontSizeMultiplier={NumeralMaxScale}>
              {glasses}
            </ThemedText>
            <ThemedText type="titleMedium" themeColor="onSurfaceVariant">
              {glassesOf !== null ? `of ${glassesOf} glasses` : glassWord}
            </ThemedText>
          </View>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
            {s?.progressText ?? formatWater(total, units)}
          </ThemedText>
        </View>
        <Button
          label="+1 glass"
          icon="add"
          compact
          onPress={async () => onAdded(await water.add())}
          accessibilityLabel={`Add a glass, ${formatWater(glassMl, units)}`}
        />
      </View>

      {target ? (
        <TickBar
          value={total}
          max={target.ml}
          tone="water"
          color={limit ? theme.outline : undefined}
          accessibilityLabel={s?.progressText}
        />
      ) : null}

      {s?.reached ? (
        <View style={styles.inline}>
          <Ionicons name="checkmark-circle" size={20} color={theme.water} />
          <ThemedText type="labelLarge">Target reached</ThemedText>
        </View>
      ) : null}

      {target ? (
        <View style={styles.inline}>
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.grow}>
            {target.suggested ? `Suggested ${target.label}` : target.label}
          </ThemedText>
          <Button label={target.suggested ? 'Set' : 'Change'} variant="text" compact onPress={() => setEditing(true)} />
        </View>
      ) : (
        <Button label="Set a target" variant="text" compact onPress={() => setEditing(true)} />
      )}

      <View style={styles.links}>
        <Button
          label="Other amount"
          variant="text"
          compact
          onPress={() => router.navigate({ pathname: '/journal', params: { section: 'water' } })}
        />
        {s?.remindedToday && !s.snoozed ? (
          <Button label="No more reminders today" variant="text" compact onPress={water.snooze} />
        ) : null}
      </View>
      <WaterSheet visible={editing} onClose={() => setEditing(false)} />
    </>
  );
}

/** The water card on the Food tab. */
export function WaterCard({ water, onAdded }: { water: WaterHook; onAdded: (a: AddedGlass | null) => void }) {
  return (
    <Card title="Water">
      <WaterBody water={water} onAdded={onAdded} />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexWrap: 'wrap' },
  numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, flexWrap: 'wrap' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginLeft: -Spacing.three },
  grow: { flex: 1 },
});
