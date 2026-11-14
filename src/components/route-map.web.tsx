import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActiveTheme, Spacing } from '@/constants/theme';
import { mapColorsOf } from '@/constants/themes/build';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkPoint } from '@/lib/walk';
import type { RouteLine } from '@/walks/view';

import { mapSchemeFor } from './map-style';
import type { RouteDot } from './route-map';
import { RouteSketch } from './route-sketch';

const DEFAULT_DOT: RouteDot = { r: 7.5, ring: 3 };

/** Web preview: the map library is native-only, so this draws the route's shape on the theme's map land. */
export function RouteMap({
  points,
  lines,
  height,
  dots,
  radius,
  label,
  children,
}: {
  points?: WalkPoint[];
  lines?: RouteLine[];
  height: number;
  follow?: boolean;
  /** Default: 6 dp dots inside 3 dp rings, as on the phone. */
  dots?: { start: RouteDot; end: RouteDot };
  radius?: number;
  label?: string;
  children?: ReactNode;
}) {
  // The map follows its theme, never the phone's dark mode (mapSchemeFor).
  const colors = mapColorsOf(ActiveTheme, mapSchemeFor(useColorScheme()));
  const [width, setWidth] = useState(0);
  return (
    <View
      style={[
        styles.frame,
        {
          height,
          backgroundColor: colors.land,
          borderRadius: radius ?? colors.radius,
          ...(colors.border ? { borderWidth: 1, borderColor: colors.border } : null),
        },
      ]}
      accessible={!!label}
      accessibilityLabel={label}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <RouteSketch
          points={points}
          lines={lines}
          width={width}
          height={height}
          map={{ colors, dots: dots ?? { start: DEFAULT_DOT, end: DEFAULT_DOT } }}
        />
      ) : null}
      <View style={styles.note}>
        <ThemedText type="labelSmall" themeColor="onSurfaceVariant">
          Map shows on the phone
        </ThemedText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  note: { position: 'absolute', left: Spacing.three, bottom: Spacing.two },
});
