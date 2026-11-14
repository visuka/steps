import { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { base64Bytes, LABEL_MAX_BYTES } from '@/api/scan-read';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, IconButton, Notice } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { CameraPermission } from './scan-camera';

/** Long edge in px, then a smaller try if the JPEG is still over the server's limit. */
const EDGES = [1600, 1200] as const;

/**
 * The photo as a base64 JPEG the server takes (1600 px long edge, quality
 * 0.7, at most 1.5 MB). The picture stays in memory (pictureRef); the
 * resized copy that saving writes to the app's cache is deleted at once, so
 * no photo is kept on the phone.
 */
async function labelPhoto(camera: CameraView): Promise<string> {
  const picture = await camera.takePictureAsync({ quality: 0.8, pictureRef: true });
  try {
    for (const edge of EDGES) {
      const wide = picture.width >= picture.height;
      const size = wide ? { width: Math.min(edge, picture.width) } : { height: Math.min(edge, picture.height) };
      const context = ImageManipulator.manipulate(picture).resize(size);
      const image = await context.renderAsync();
      let uri: string | null = null;
      try {
        const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
        uri = saved.uri;
        if (saved.base64 && base64Bytes(saved.base64) <= LABEL_MAX_BYTES) return saved.base64;
      } finally {
        image.release();
        context.release();
        if (uri) dropFile(uri);
      }
    }
    throw new Error('too large');
  } finally {
    picture.release();
  }
}

/** Deletes a cached copy; a copy that can't be deleted is left for the system to clear. */
function dropFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Never fails the photo.
  }
}

/**
 * "Photograph the nutrition label": how to frame it, then one photo, sent
 * once to be read. The photo goes to our AI provider and is not kept.
 */
export function LabelCapture({
  name,
  onPhoto,
  onCancel,
  onManual,
}: {
  /** The product, when we know its name. */
  name?: string;
  onPhoto: (base64: string) => void;
  onCancel: () => void;
  onManual: () => void;
}) {
  const theme = useTheme();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const take = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const base64 = await labelPhoto(camera.current);
      setTorch(false);
      onPhoto(base64);
    } catch {
      setProblem("Couldn't take the photo. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CameraPermission why="Photograph the nutrition table on the pack, and we'll read the values from it." onManual={onManual}>
      <Card title={name ? `Nutrition label: ${name}` : 'Photograph the nutrition label'}>
        <ThemedText type="bodyMedium">
          Fit the whole table of values in the frame, flat and close, in good light. Tilt the pack to avoid glare.
        </ThemedText>
        <View style={[styles.finder, { backgroundColor: theme.inverseSurface }]}>
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)} />
          <View style={styles.torch}>
            <IconButton
              icon={torch ? 'flashlight' : 'flashlight-outline'}
              variant={torch ? 'filled' : 'tonal'}
              onPress={() => setTorch(!torch)}
              accessibilityLabel={torch ? 'Turn the torch off' : 'Turn the torch on'}
            />
          </View>
        </View>
        {problem ? <Notice tone="problem" text={problem} /> : null}
        <Button label="Take photo" icon="camera" onPress={take} loading={busy} disabled={!ready} />
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          The photo is sent once to our AI provider to read the values, and is not kept.
        </ThemedText>
        <Button variant="text" label="Cancel" onPress={onCancel} disabled={busy} />
      </Card>
    </CameraPermission>
  );
}

const styles = StyleSheet.create({
  finder: { width: '100%', aspectRatio: 3 / 4, borderRadius: Radius.md, overflow: 'hidden' },
  torch: { position: 'absolute', top: Spacing.two, right: Spacing.two },
});
