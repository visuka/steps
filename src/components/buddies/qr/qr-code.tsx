/**
 * A QR code drawn from the encoder's modules (src/buddies/qr/encode.ts) with
 * react-native-svg: one path of dark squares on a white tile, with the quiet
 * zone of 4 light modules round it (PLAIN_QR). Whole dp per module, so the
 * edges stay sharp.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { modulePath, qrLayout } from '@/buddies/qr/draw';
import { encodeQr } from '@/buddies/qr/encode';
import { PLAIN_QR } from '@/components/plain/plain-theme';

export function QrCode({ value, side, label }: { value: string; side: number; label: string }) {
  const qr = useMemo(() => encodeQr(value), [value]);
  const { units, px } = qrLayout(qr.size, PLAIN_QR.quiet, side);
  const d = useMemo(() => modulePath(qr.modules, PLAIN_QR.quiet), [qr]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ width: px, height: px, borderRadius: PLAIN_QR.radius, overflow: 'hidden', backgroundColor: PLAIN_QR.light, alignSelf: 'center' }}>
      <Svg width={px} height={px} viewBox={`0 0 ${units} ${units}`}>
        <Rect x={0} y={0} width={units} height={units} fill={PLAIN_QR.light} />
        <Path d={d} fill={PLAIN_QR.dark} />
      </Svg>
    </View>
  );
}
