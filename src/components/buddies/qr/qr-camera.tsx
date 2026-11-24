/**
 * The Buddies QR scanner: the back camera reading QR codes only, after the
 * same plain camera ask the food scanner uses (CameraPermission), with
 * "Enter walker ID instead" as the way round the camera. The screen decides
 * what a code means (qr/club-code.ts scanOutcome).
 */
import { type BarcodeScanningResult, CameraView } from 'expo-camera';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { buzz, CameraCover, CameraPermission, useCameraCover } from '@/components/food/scan-camera';
import { ThemedText } from '@/components/themed-text';
import { Button, Notice } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The same code read again within this long is the same scan. */
const REPEAT_MS = 2500;

export function QrCamera({
  paused,
  hint,
  onText,
  onManual,
}: {
  /** A sheet is open over the camera: read nothing. */
  paused: boolean;
  hint: string | null;
  onText: (text: string) => void;
  onManual: () => void;
}) {
  const theme = useTheme();
  const last = useRef<{ text: string; at: number } | null>(null);
  // Until the first frame, a soft grey cover: no black block (rule: no black solids).
  const cover = useCameraCover();

  const onScanned = ({ data }: BarcodeScanningResult) => {
    cover.lift();
    const now = Date.now();
    const prev = last.current;
    if (prev && prev.text === data && now - prev.at < REPEAT_MS) return;
    last.current = { text: data, at: now };
    buzz('success');
    onText(data);
  };

  return (
    <CameraPermission
      why="Point the camera at a friend's or a club's QR code from Steps. Nothing is recorded; only the code is read."
      blockedWhy="To scan, turn on the camera for Steps in your phone's settings. Or enter the walker ID instead."
      manualLabel="Enter walker ID instead"
      manualIcon="search-outline"
      onManual={onManual}>
      <View style={[styles.finder, { backgroundColor: theme.surfaceContainerHigh }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={paused ? undefined : onScanned}
          onCameraReady={cover.onCameraReady}
        />
        <CameraCover ready={cover.ready} />
        <View pointerEvents="none" style={styles.frameWrap}>
          {/* White on the live picture; a soft grey on the grey cover, where white would vanish. */}
          <View style={[styles.frame, { borderColor: cover.ready ? theme.surface : theme.outline }]} />
        </View>
      </View>
      <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
        Hold the QR code inside the square. It reads by itself.
      </ThemedText>
      {hint ? <Notice tone="problem" text={hint} /> : null}
      <Button variant="tonal" label="Enter walker ID instead" icon="search-outline" onPress={onManual} />
    </CameraPermission>
  );
}

const styles = StyleSheet.create({
  finder: { width: '100%', aspectRatio: 1, borderRadius: Radius.md, overflow: 'hidden' },
  frameWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '64%', aspectRatio: 1, borderWidth: 3, borderRadius: Radius.sm },
});
