/** Today's weather beside the date (spec 5.1): the sun or sky icon and "24°C clear", s13 muted, gap 8. */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { GREETING_STYLE } from '@/components/ui/greeting-style';
import { WeatherIcon } from '@/components/walk/walk-icons';
import { useTheme } from '@/hooks/use-theme';

import type { TodayWeather } from './weather-line';

export function WeatherBesideDate({ weather }: { weather: TodayWeather }) {
  const theme = useTheme();
  return (
    <View accessible accessibilityLabel={weather.spoken} style={styles.row}>
      <WeatherIcon condition={weather.condition} color={theme.onSurfaceVariant} />
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
        {weather.text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  // The icon is 20 in an 18 line: it hangs over rather than growing the date row.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: GREETING_STYLE.dateGap,
    marginVertical: -GREETING_STYLE.weatherOverhang,
  },
});
