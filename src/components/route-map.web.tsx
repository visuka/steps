import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { WalkPoint } from '@/lib/walk';

import { RouteSketch } from './route-sketch';

/** Web preview: the map library is native-only, so this draws the route's shape. */
export function RouteMap({ points, height }: { points: WalkPoint[]; height: number; follow?: boolean }) {
  const [width, setWidth] = useState(0);
  return (
    <ThemedView
      type="backgroundSelected"
      style={[styles.frame, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? <RouteSketch points={points} width={width} height={height} /> : null}
      <View style={styles.note}>
        <ThemedText type="small" themeColor="textSecondary">
          Map shows on the phone
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: Spacing.four, overflow: 'hidden' },
  note: { position: 'absolute', left: Spacing.three, bottom: Spacing.two },
});
