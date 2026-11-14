import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Notice, Sheet } from '@/components/ui';
import { ActiveTheme, NumeralMaxScale, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { applyTheme } from '@/constants/themes/apply';
import { type ThemeDef, THEMES } from '@/constants/themes';
import { useTheme } from '@/hooks/use-theme';

/** How long "Restarting to apply" shows before the app reloads, so the tap is seen to land. */
const RESTART_PAUSE_MS = 700;

/**
 * Settings → Appearance: every theme as a small preview (its ground, three
 * data colours, a number in its own face, its name). Tapping one saves it and
 * restarts the app in it, since fonts and shapes are set at start-up.
 */
export function ThemeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const [applying, setApplying] = useState<ThemeDef | null>(null);
  const [problem, setProblem] = useState<'failed' | 'reopen' | null>(null);

  const pick = (t: ThemeDef) => {
    if (applying) return;
    if (t.id === ActiveTheme.id) {
      onClose();
      return;
    }
    setProblem(null);
    setApplying(t);
    setTimeout(async () => {
      // Still here afterwards: the choice wasn't saved, or the reload didn't happen.
      const result = await applyTheme(t.id).catch(() => 'failed' as const);
      setProblem(result);
      setApplying(null);
    }, RESTART_PAUSE_MS);
  };

  return (
    <Sheet visible={visible} onClose={applying ? () => undefined : onClose} title="Appearance">
      {applying ? (
        <View style={styles.restart} accessibilityLiveRegion="polite" accessible>
          <ActivityIndicator color={theme.primary} />
          <ThemedText type="bodyLarge">Restarting to apply {applying.name}…</ThemedText>
        </View>
      ) : (
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
          The app restarts to change its look. Your data stays as it is.
        </ThemedText>
      )}
      {problem === 'failed' ? <Notice tone="problem" text="Couldn't change the look. Try again." /> : null}
      {problem === 'reopen' ? <Notice text="The new look is saved. Close and reopen the app to finish." /> : null}
      <View style={styles.list} accessibilityRole="radiogroup">
        {THEMES.map((t) => (
          <ThemeRow key={t.id} t={t} current={t.id === ActiveTheme.id} busy={applying !== null} onPress={() => pick(t)} />
        ))}
      </View>
    </Sheet>
  );
}

function ThemeRow({ t, current, busy, onPress }: { t: ThemeDef; current: boolean; busy: boolean; onPress: () => void }) {
  const theme = useTheme();
  const c = t.colors[t.mode];
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="radio"
      accessibilityState={{ checked: current, disabled: busy }}
      accessibilityLabel={`${t.name}${current ? ', in use' : ''}. ${t.description}`}
      android_ripple={{ color: theme.outlineVariant }}
      style={({ pressed }) => [
        styles.row,
        { borderColor: current ? theme.primary : theme.outlineVariant, borderWidth: current ? 2 : 1 },
        pressed && { backgroundColor: theme.surfaceContainerHighest },
      ]}>
      {/* The preview: the theme's own ground, marks and numeral face. */}
      <View style={[styles.preview, { backgroundColor: c.surface, borderColor: c.outlineVariant }]} importantForAccessibility="no-hide-descendants">
        <ThemedText
          type="titleMedium"
          maxFontSizeMultiplier={NumeralMaxScale}
          numberOfLines={1}
          style={{ color: c.onSurface, fontFamily: t.fonts.numeral.family }}>
          6,240
        </ThemedText>
        <View style={styles.swatches}>
          {[c.steps, c.food, c.water].map((color, i) => (
            <View key={i} style={[styles.swatch, { backgroundColor: color }]} />
          ))}
        </View>
      </View>
      <View style={styles.text}>
        <ThemedText type="titleMedium" style={{ fontFamily: t.fonts.semibold.family }}>
          {t.name}
        </ThemedText>
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" numberOfLines={3}>
          {t.description}
        </ThemedText>
        {current ? (
          <View style={styles.inUse}>
            <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
            <ThemedText type="labelMedium" themeColor="primary">
              In use
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  restart: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: TouchTarget },
  list: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    minHeight: 88,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  preview: {
    width: 96,
    alignSelf: 'stretch',
    minHeight: 72,
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.two,
    justifyContent: 'space-between',
  },
  swatches: { flexDirection: 'row', gap: Spacing.one },
  swatch: { flex: 1, height: 8, borderRadius: 4 },
  text: { flex: 1, gap: Spacing.half },
  inUse: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
