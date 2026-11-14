import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { LABEL_ATTRIBUTION, LABEL_KEYS, OFF_TERMS_URL, type ScanProduct } from '@/api/scan-read';
import { PortionPicker } from '@/components/food/portion-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Notice } from '@/components/ui';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PortionOverrides } from '@/nutrition/catalog';
import { nutrientNumber } from '@/nutrition/nutrients';
import { isLiquid, productTable, servingUnit } from '@/nutrition/scan';
import type { FoodItem } from '@/nutrition/types';

/** A link, opened in the browser. Small text, but a full-size (48 dp) place to tap. */
function Link({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => Linking.openURL(url).catch(() => undefined)}
      style={styles.linkTarget}>
      <ThemedText type="bodySmall" themeColor="primary" style={styles.link}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** The pack's table: per serving (when the pack has one) and per 100 g or ml, read-only. */
export function ProductTable({ food }: { food: FoodItem }) {
  const theme = useTheme();
  const rows = productTable(food, LABEL_KEYS);
  const serving = servingUnit(food);
  const per = isLiquid(food) ? 'ml' : 'g';
  if (!rows.length) return null;
  return (
    <View accessibilityRole="summary" style={styles.table}>
      <View style={[styles.row, { borderBottomColor: theme.outlineVariant }]}>
        <ThemedText type="labelMedium" themeColor="onSurfaceVariant" style={styles.nameCol}>
          Nutrient
        </ThemedText>
        {serving ? (
          <ThemedText type="labelMedium" themeColor="onSurfaceVariant" style={styles.numCol}>
            Per serving ({Math.round(serving.grams)} {per})
          </ThemedText>
        ) : null}
        <ThemedText type="labelMedium" themeColor="onSurfaceVariant" style={styles.numCol}>
          Per 100 {per}
        </ThemedText>
      </View>
      {rows.map((r) => (
        <View
          key={r.key}
          style={[styles.row, { borderBottomColor: theme.outlineVariant }]}
          accessible
          accessibilityLabel={`${r.label}: ${serving && r.perServing !== null ? `${nutrientNumber(r.key, r.perServing)} ${r.unit} per serving, ` : ''}${nutrientNumber(r.key, r.per100)} ${r.unit} per 100 ${per}`}>
          <ThemedText type="bodyMedium" style={styles.nameCol}>
            {r.label}
          </ThemedText>
          {serving ? (
            <ThemedText type="bodyMedium" style={styles.numCol}>
              {r.perServing === null ? '' : `${nutrientNumber(r.key, r.perServing)} ${r.unit}`}
            </ThemedText>
          ) : null}
          <ThemedText type="bodyMedium" style={styles.numCol}>
            {nutrientNumber(r.key, r.per100)} {r.unit}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Where a scanned product's numbers came from, as their licence and our honesty need it. */
export function ProductSource({ product }: { product: ScanProduct }) {
  if (product.origin === 'label') {
    return (
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
        {LABEL_ATTRIBUTION}
      </ThemedText>
    );
  }
  return <OffSource attribution={product.attribution} />;
}

/** Open Food Facts' line, with links to the product on their site and to their terms (ODbL). */
export function OffSource({ attribution: a }: { attribution?: ScanProduct['attribution'] }) {
  return (
    <View style={styles.source}>
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
        {a?.text}
      </ThemedText>
      <View style={styles.links}>
        {a?.url ? <Link label="This product on Open Food Facts" url={a.url} /> : null}
        <Link label="Their terms" url={OFF_TERMS_URL} />
      </View>
    </View>
  );
}

/**
 * A scanned pack: name, brand and pack size, its table per serving and per
 * 100 g, then the usual portion picker to add it. "Add to my foods" keeps it
 * as the person's own food; a label photo is offered when the numbers look wrong.
 */
export function ProductSheet({
  food,
  product,
  overrides,
  offline,
  note,
  busy,
  onAdd,
  onSetPortion,
  onAddOwn,
  onPhotoLabel,
  onScanAnother,
  children,
}: {
  food: FoodItem;
  product: ScanProduct;
  overrides: PortionOverrides;
  /** Shown from the phone's recent scans while offline. */
  offline?: boolean;
  /** A line after Add to my foods or a confirm ("Saved to your foods"). */
  note?: string | null;
  busy?: boolean;
  onAdd: (unit: string, quantity: number) => void;
  onSetPortion: (unit: string, grams: number) => void;
  onAddOwn: () => void;
  onPhotoLabel?: () => void;
  onScanAnother: () => void;
  /** Under the preview: when it was eaten. */
  children?: React.ReactNode;
}) {
  const sizes = [product.brand, product.packText].filter(Boolean).join(' · ');
  return (
    <Card title={product.name || food.name}>
      {sizes ? (
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
          {sizes}
        </ThemedText>
      ) : null}
      {offline ? <Notice text="You’re offline. These are the values from when you last scanned it." /> : null}
      <ProductTable food={food} />
      <PortionPicker
        food={food}
        overrides={overrides}
        actionLabel="Add to today"
        busy={busy}
        onCancel={onScanAnother}
        onSetPortion={onSetPortion}
        onDone={(unit, quantity) => onAdd(unit, quantity)}>
        {children}
      </PortionPicker>
      <Button variant="tonal" label="Add to my foods" icon="bookmark-outline" onPress={onAddOwn} disabled={busy} />
      {note ? <Notice tone="done" text={note} /> : null}
      <ProductSource product={product} />
      {onPhotoLabel ? (
        <Button variant="text" compact label="Numbers look wrong? Photograph the label" onPress={onPhotoLabel} disabled={busy} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  table: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameCol: { flex: 1.3 },
  numCol: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  source: { gap: Spacing.one },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three },
  linkTarget: { minHeight: TouchTarget, minWidth: TouchTarget, justifyContent: 'center' },
  link: { textDecorationLine: 'underline' },
});
