import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, IconButton, Notice } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createScanGate, manualHint, manualState } from '@/nutrition/barcode';

/** Food packs: EAN-13, EAN-8, UPC-A, UPC-E, and QR codes (GS1 Digital Link). */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] as const;

/** Never fails a scan: some phones have no vibration motor. */
export function buzz(kind: 'success' | 'warning') {
  const type = kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning;
  Haptics.notificationAsync(type).catch(() => undefined);
}

/**
 * The camera, once the person has said yes. First a short word on why, with
 * "Allow camera"; when the phone won't ask again, Open Settings. Typing the
 * number is always there instead.
 */
export function CameraPermission({ why, onManual, children }: { why: string; onManual: () => void; children: ReactNode }) {
  const theme = useTheme();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [asking, setAsking] = useState(false);
  const granted = permission?.granted ?? false;

  // The hook reads the permission once. Coming back from Settings (Android doesn't restart
  // the app when the camera is turned on) it's read again, so the camera shows straight away.
  useEffect(() => {
    if (granted) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') getPermission().catch(() => undefined);
    });
    return () => sub.remove();
  }, [granted, getPermission]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  if (permission.granted) return children;

  const blocked = permission.status === 'denied' && !permission.canAskAgain;
  return (
    <Card title={blocked ? 'Camera is off for Steps' : 'Use the camera'}>
      <ThemedText type="bodyMedium">
        {blocked ? 'To scan, turn on the camera for Steps in your phone’s settings. Or type the number under the barcode.' : why}
      </ThemedText>
      {blocked ? (
        <Button label="Open Settings" icon="settings-outline" onPress={() => Linking.openSettings().catch(() => undefined)} />
      ) : (
        <Button
          label="Allow camera"
          icon="camera-outline"
          loading={asking}
          onPress={() => {
            setAsking(true);
            requestPermission().finally(() => setAsking(false));
          }}
        />
      )}
      <Button variant="tonal" label="Type the number" icon="keypad-outline" onPress={onManual} />
    </Card>
  );
}

/**
 * The viewfinder: reads barcodes and QR codes and locks on the first product
 * code. Other codes are ignored for a moment before a hint shows, so a blurry
 * guess while focusing doesn't flash an error. The torch starts off and goes
 * off with the screen.
 */
export function ScanCamera({
  hint,
  onCode,
  onHint,
  onManual,
}: {
  hint?: string;
  onCode: (gtin: string, code: string) => void;
  onHint: (message: string) => void;
  onManual: () => void;
}) {
  const theme = useTheme();
  const [gate] = useState(createScanGate);
  const [locked, setLocked] = useState(false);
  const [torch, setTorch] = useState(false);

  const onScanned = ({ type, data }: BarcodeScanningResult) => {
    const r = gate.feed(type, data, Date.now());
    if (r.action === 'accept') {
      setLocked(true);
      setTorch(false);
      buzz('success');
      onCode(r.gtin, r.code);
    } else if (r.action === 'hint') {
      buzz('warning');
      onHint(r.message);
    }
  };

  return (
    <CameraPermission
      why="Point the camera at the barcode or QR code on a food pack. Nothing is recorded; only the number is read."
      onManual={onManual}>
      <View style={[styles.finder, { backgroundColor: theme.inverseSurface }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={locked ? undefined : onScanned}
        />
        <View pointerEvents="none" style={styles.frameWrap}>
          <View style={[styles.frame, { borderColor: theme.surface }]} />
        </View>
        <View style={styles.torch}>
          <IconButton
            icon={torch ? 'flashlight' : 'flashlight-outline'}
            variant={torch ? 'filled' : 'tonal'}
            onPress={() => setTorch(!torch)}
            accessibilityLabel={torch ? 'Turn the torch off' : 'Turn the torch on'}
          />
        </View>
      </View>
      <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
        Hold the barcode inside the frame. It reads by itself.
      </ThemedText>
      {hint ? <Notice tone="problem" text={hint} /> : null}
      <Button variant="tonal" label="Type the number" icon="keypad-outline" onPress={onManual} />
    </CameraPermission>
  );
}

/** The number under the barcode, checked as it's typed. */
export function ManualEntry({ onCode, onScan }: { onCode: (gtin: string, code: string) => void; onScan?: () => void }) {
  const [text, setText] = useState('');
  const state = manualState(text);
  const hint = manualHint(state);
  return (
    <Card title="Type the number">
      <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
        The 8 to 14 digits under the barcode.
      </ThemedText>
      <TextField
        label="Barcode number"
        value={text}
        onChangeText={(t) => setText(t.replace(/[^\d ]/g, '').slice(0, 20))}
        placeholder="8901234567890"
        keyboardType="number-pad"
        autoFocus
        maxLength={20}
      />
      {hint ? <Notice tone={state.status === 'typing' ? 'info' : 'problem'} text={hint} /> : null}
      <Button
        label="Look it up"
        disabled={state.status !== 'ok'}
        onPress={() => state.status === 'ok' && onCode(state.gtin, state.code)}
      />
      {onScan ? <Button variant="text" label="Scan instead" icon="barcode-outline" onPress={onScan} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.five, alignItems: 'center' },
  finder: { width: '100%', aspectRatio: 3 / 4, borderRadius: Radius.md, overflow: 'hidden' },
  frameWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '78%', aspectRatio: 1.6, borderWidth: 3, borderRadius: Radius.sm },
  torch: { position: 'absolute', top: Spacing.two, right: Spacing.two },
});
