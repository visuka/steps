import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WalkPoint } from '@/lib/walk';
import type { RouteLine } from '@/walks/view';

import { RouteSketch } from './route-sketch';

/** Web preview: the map library is native-only, so this draws the route's shape. */
export function RouteMap({
  points,
  lines,
  height,
}: {
  points?: WalkPoint[];
  lines?: RouteLine[];
  height: number;
  follow?: boolean;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  return (
    <View
      style={[styles.frame, { height, backgroundColor: theme.surfaceContainerHigh }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? <RouteSketch points={points} lines={lines} width={width} height={height} /> : null}
      <View style={styles.note}>
        <ThemedText type="labelSmall" themeColor="onSurfaceVariant">
          Map shows on the phone
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: Radius.md, overflow: 'hidden' },
  note: { position: 'absolute', left: Spacing.three, bottom: Spacing.two },
});
