import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { checkConfirmForm, type ConfirmForm, type LabelResult, type ScanPartial } from '@/api/scan-read';
import { NumberField, TextField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Notice } from '@/components/ui';
import { Spacing } from '@/constants/theme';

import { OffSource, ProductTable } from './product-sheet';

/**
 * What was read off the label, to confirm before it's saved for everyone who
 * scans this barcode. The person names it and sets the serving and pack
 * size; the numbers are read-only (they stay as the server read and checked
 * them). "Add to my foods only" keeps it private and shares nothing.
 */
export function LabelConfirm({
  label,
  knownName,
  busy,
  problem,
  onShare,
  onOwnOnly,
  onRetake,
}: {
  label: LabelResult;
  /** A name Open Food Facts had without nutrients. */
  knownName?: ScanPartial;
  busy?: boolean;
  problem?: string | null;
  onShare: (form: ConfirmForm) => void;
  onOwnOnly: (form: ConfirmForm) => void;
  onRetake: () => void;
}) {
  const { read, food, warnings } = label;
  const [form, setForm] = useState<ConfirmForm>({
    name: read.name ?? knownName?.name ?? '',
    brand: read.brand ?? knownName?.brand ?? '',
    servingGrams: read.servingGrams ?? null,
    servingLabel: read.servingText ?? '',
    packGrams: read.packGrams ?? null,
  });
  // Open Food Facts' name or brand pre-filled the form: their line goes with it.
  const fromOff = !!knownName?.attribution && ((!read.name && !!knownName.name) || (!read.brand && !!knownName.brand));
  const [tried, setTried] = useState(false);
  const change = (patch: Partial<ConfirmForm>) => setForm((f) => ({ ...f, ...patch }));
  const formProblem = checkConfirmForm(form);
  const liquid = read.basis === '100ml';
  const unit = liquid ? 'ml' : 'g';

  const submit = (then: (f: ConfirmForm) => void) => {
    setTried(true);
    if (!formProblem) then(form);
  };

  return (
    <Card title="Check what we read">
      <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
        Values per 100 {unit}, read from your photo. If they don’t match the pack, photograph it again.
      </ThemedText>
      <ProductTable food={food} />
      {warnings.map((w) => (
        <Notice key={w} text={w} />
      ))}

      <TextField label="Name" value={form.name} onChangeText={(name) => change({ name })} placeholder="Name, as on the pack" maxLength={80} />
      <TextField label="Brand" value={form.brand} onChangeText={(brand) => change({ brand })} placeholder="Brand (optional)" maxLength={60} />
      {fromOff ? <OffSource attribution={knownName?.attribution} /> : null}
      <NumberField
        label="One serving"
        unit={unit}
        value={form.servingGrams}
        onCommit={(servingGrams) => change({ servingGrams })}
        placeholder="—"
      />
      <TextField
        label="Serving in words"
        value={form.servingLabel}
        onChangeText={(servingLabel) => change({ servingLabel })}
        placeholder="e.g. 2 biscuits (optional)"
        maxLength={40}
      />
      <NumberField label="Whole pack" unit={unit} value={form.packGrams} onCommit={(packGrams) => change({ packGrams })} placeholder="—" />

      {tried && formProblem ? <Notice tone="problem" text={formProblem} /> : null}
      {problem ? <Notice tone="problem" text={problem} /> : null}
      <Notice text="Saved for everyone who scans this barcode." />
      <View style={styles.actions}>
        <Button label="Save for everyone" onPress={() => submit(onShare)} loading={busy} />
        <Button variant="tonal" label="Add to my foods only" onPress={() => submit(onOwnOnly)} disabled={busy} />
        <Button variant="text" label="Photograph again" icon="camera-outline" onPress={onRetake} disabled={busy} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.two },
});
