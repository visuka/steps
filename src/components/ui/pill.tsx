import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { SpecIcon } from './icons';
import { PILL_STYLE, pillColors, type PillVariant } from './pill-style';

export type { PillVariant } from './pill-style';

export interface PillProps {
  label: string;
  variant?: PillVariant;
}

/** A small label pill ("78%", "7:10 am", "High"): one line, width = text + 16. */
export function Pill({ label, variant = 'tint' }: PillProps) {
  const theme = useTheme();
  const { fill, text } = pillColors(theme, variant);
  const warning = variant === 'warning';
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: fill },
        warning && { paddingLeft: PILL_STYLE.warningPaddingLeft, gap: PILL_STYLE.warningGap },
      ]}>
      {warning ? <SpecIcon name="warning" color={text} size={PILL_STYLE.iconSize} /> : null}
      <ThemedText
        type="bodySmall"
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={{ color: text, fontWeight: PILL_STYLE.fontWeight }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: PILL_STYLE.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PILL_STYLE.paddingX,
    borderRadius: PILL_STYLE.radius,
  },
});
