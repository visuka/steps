import { useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { confirmLabel, lookupBarcode, readLabelPhoto, ScanError } from '@/api/food-scan';
import type { ConfirmForm, ScanProduct } from '@/api/scan-read';
import { LabelCapture } from '@/components/food/label-capture';
import { LabelConfirm } from '@/components/food/label-confirm';
import { OwnFoodForm } from '@/components/food/own-food-form';
import { PortionPicker } from '@/components/food/portion-picker';
import { OffSource, ProductSheet } from '@/components/food/product-sheet';
import { ManualEntry, ScanCamera } from '@/components/food/scan-camera';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Notice, Screen } from '@/components/ui';
import { WhenField } from '@/components/when-field';
import { Spacing } from '@/constants/theme';
import { newId } from '@/data/types';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { timeNow } from '@/lib/when';
import { displayCode } from '@/nutrition/barcode';
import { ownFoodItem } from '@/nutrition/catalog';
import { labelFood, ownFoodFromScan, productTitle, scanEntry } from '@/nutrition/scan';
import { queueAction, type ScanStep, scanReducer, START } from '@/nutrition/scan-flow';
import type { FoodItem, OwnFood } from '@/nutrition/types';
import { useApp } from '@/state/app-state';
import { useFoodBook } from '@/state/use-food-book';
import { useScanStore } from '@/state/use-scan-store';

/** Codes looked up quietly on opening, from the offline list. */
const QUEUE_PER_OPEN = 5;

const messageOf = (e: unknown) => (e instanceof ScanError ? e.message : 'Something went wrong. Please try again.');

/**
 * Food → Scan: a barcode or QR code on a pack → the product → Add to today.
 * Unknown packs: photograph the nutrition label, or add it yourself. The
 * steps are nutrition/scan-flow.ts; this screen does the calls and saving.
 */
export function ScanScreen({ onClose }: { onClose: () => void }) {
  const { repo, source, touch } = useApp();
  const book = useFoodBook();
  const store = useScanStore();
  const now = useNow();
  const [step, dispatch] = useReducer(scanReducer, START);
  const [eatenAt, setEatenAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** An own food to add now: one made from this code earlier, or just now. */
  const [ownPick, setOwnPick] = useState<FoodItem | null>(null);
  /** Found while the person was away (offline list), to open. */
  const [found, setFound] = useState<{ gtin: string; food: FoodItem; product: ScanProduct }[]>([]);
  const queueRan = useRef(false);
  /** One own food per tap: a second tap while it saves does nothing. */
  const savingOwn = useRef(false);

  const linkedOwn = (gtin: string): OwnFood | null => {
    const id = store.own[gtin];
    return id ? (book.own.find((o) => o.id === id) ?? null) : null;
  };

  const fresh = (next?: () => void) => {
    setNote(null);
    setProblem(null);
    setOwnPick(null);
    next?.();
  };

  const remember = (gtin: string, food: FoodItem, product: ScanProduct) =>
    store.remember({ gtin, food, product, at: timeNow() });

  const lookUp = async (gtin: string, code: string) => {
    fresh(() => dispatch({ type: 'code', gtin, code }));
    try {
      const r = await lookupBarcode(code, gtin);
      if (r.found) {
        remember(gtin, r.food, r.product);
        dispatch({ type: 'found', gtin, food: r.food, product: r.product });
      } else {
        dispatch({ type: 'notFound', gtin, partial: r.partial, canReadLabel: r.canReadLabel });
      }
    } catch (e) {
      if (e instanceof ScanError && (e.kind === 'offline' || e.kind === 'timeout')) {
        const kept = store.recent(gtin);
        if (kept) {
          dispatch({ type: 'found', gtin, food: kept.food, product: kept.product, offline: true });
          return;
        }
        if (e.kind === 'offline') {
          store.enqueue(gtin);
          dispatch({ type: 'queued', gtin });
          return;
        }
      }
      dispatch({ type: 'failed', gtin, message: messageOf(e) });
    }
  };

  // Codes saved while offline are looked up on the next open, a few at a time.
  useEffect(() => {
    if (!store.loaded || queueRan.current || !store.queue.length) return;
    queueRan.current = true;
    (async () => {
      for (const gtin of store.queue.slice(0, QUEUE_PER_OPEN)) {
        try {
          const r = await lookupBarcode(displayCode(gtin), gtin);
          store.dequeue(gtin);
          if (r.found) {
            remember(gtin, r.food, r.product);
            setFound((f) => [...f, { gtin, food: r.food, product: r.product }]);
          }
        } catch (e) {
          // Still offline, the day's limit or a busy server: the rest wait for the next open.
          // A code that fails on its own is dropped or moved behind the others, so it can't block them.
          const action = queueAction(e instanceof ScanError ? e.kind : undefined);
          if (action === 'wait') return;
          if (action === 'drop') store.dequeue(gtin);
          else store.enqueue(gtin);
        }
      }
    })();
    // Once per open, when the lists have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.loaded]);

  /** Adds an amount to today's log (or when picked) and closes. Packs are kept on the phone first. */
  const addToLog = async (food: FoodItem, unit: string, quantity: number) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const kept = food.category === 'own' ? food : await book.saveFood(food);
      const at = eatenAt ?? timeNow();
      const { entry, nutrients } = scanEntry(kept, unit, quantity, book.overrides, at, newId());
      try {
        entry.healthSampleId = (await source.writeFood?.(entry.name, nutrients, new Date(at))) ?? null;
      } catch {
        // Saved here even when the copy to Health fails; the Food tab says so on its own entries.
      }
      await repo.addFood(entry);
      touch();
      onClose();
    } catch {
      setProblem("Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /** Keeps a scanned pack (or a label read) as the person's own food, linked to its code. */
  const keepOwn = async (gtin: string, own: OwnFood): Promise<boolean> => {
    try {
      await book.saveOwn(own);
      await store.linkOwn(gtin, own.id);
      return true;
    } catch {
      setProblem("Couldn't save it on this phone. Please try again.");
      return false;
    }
  };

  /** Saves one own food, with Busy on, and ignores taps while it does. */
  const saveOwnOnce = async (gtin: string, own: OwnFood): Promise<boolean> => {
    if (savingOwn.current) return false;
    savingOwn.current = true;
    setBusy(true);
    try {
      return await keepOwn(gtin, own);
    } finally {
      savingOwn.current = false;
      setBusy(false);
    }
  };

  const addProductToOwn = async (gtin: string, food: FoodItem) => {
    if (savingOwn.current) return;
    const unit = food.units.some((u) => u.key === 'serving') ? 'serving' : 'g';
    const own = ownFoodFromScan(food, unit, newId(), timeNow(), book.overrides);
    if (await saveOwnOnce(gtin, own)) setNote(`Saved to your foods as “${own.name}”.`);
  };

  const photoTaken = async (gtin: string, code: string, base64: string) => {
    dispatch({ type: 'photoTaken' });
    try {
      const label = await readLabelPhoto(code, gtin, base64);
      dispatch({ type: 'labelRead', gtin, label });
    } catch (e) {
      dispatch({ type: 'failed', gtin, message: messageOf(e) });
    }
  };

  const share = async (s: Extract<ScanStep, { kind: 'confirm' }>, form: ConfirmForm) => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await confirmLabel(s.label.draft.id, s.code, s.gtin, form);
      // r.food's brand: the form's for our own save, the server's when someone else's record came back.
      const brand = r.food.brand;
      const product: ScanProduct = { gtin: s.gtin, name: r.food.name, origin: 'label', ...(brand ? { brand } : {}) };
      remember(s.gtin, r.food, product);
      dispatch({ type: 'confirmed', gtin: s.gtin, food: r.food, product });
      setNote(
        r.existing
          ? 'Someone saved this product first, so theirs is shown. Check it against the pack.'
          : 'Saved. The next person who scans it gets it straight away.',
      );
    } catch (e) {
      if (e instanceof ScanError && e.kind === 'expired') dispatch({ type: 'failed', gtin: s.gtin, message: e.message });
      else setProblem(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const ownOnly = async (s: Extract<ScanStep, { kind: 'confirm' }>, form: ConfirmForm) => {
    const food = labelFood(s.label.food, form);
    const own = ownFoodFromScan(food, food.defaultUnit, newId(), timeNow(), book.overrides);
    if (await saveOwnOnce(s.gtin, own)) setOwnPick(ownFoodItem(own));
  };

  const when = <WhenField value={eatenAt ?? now} onChange={setEatenAt} />;

  /** An own food's portion picker, for "you added this yourself" and right after "my foods only". */
  const ownPicker = (food: FoodItem, onCancel: () => void) => (
    <Card title="Your own food">
      <PortionPicker
        key={food.id}
        food={food}
        overrides={book.overrides}
        actionLabel="Add to today"
        busy={busy}
        onCancel={onCancel}
        onSetPortion={(unit, grams) => book.setPortion(food, unit, grams)}
        onDone={(unit, quantity) => addToLog(food, unit, quantity)}>
        {when}
      </PortionPicker>
    </Card>
  );

  const scanAnother = () => fresh(() => dispatch({ type: 'scan' }));
  const typeNumber = () => fresh(() => dispatch({ type: 'manual' }));

  const body = (): React.ReactNode => {
    if (ownPick) return ownPicker(ownPick, scanAnother);
    switch (step.kind) {
      case 'camera':
        return (
          <>
            {found.length ? (
              <Card title="Looked up while you were away">
                <View style={styles.chips}>
                  {found.map((f) => (
                    <Chip
                      key={f.gtin}
                      label={productTitle(f.product.name, f.product.brand)}
                      onPress={() => {
                        dispatch({ type: 'code', gtin: f.gtin, code: displayCode(f.gtin) });
                        dispatch({ type: 'found', gtin: f.gtin, food: f.food, product: f.product });
                      }}
                    />
                  ))}
                </View>
              </Card>
            ) : null}
            <ScanCamera
              hint={step.hint}
              onCode={lookUp}
              onHint={(message) => dispatch({ type: 'hint', message })}
              onManual={typeNumber}
            />
          </>
        );
      case 'manual':
        return <ManualEntry onCode={lookUp} onScan={scanAnother} />;
      case 'looking':
        return <Waiting text={`Looking up ${step.code}…`} />;
      case 'reading':
        return <Waiting text="Reading the label… this can take up to half a minute." />;
      case 'product':
        return (
          <ProductSheet
            food={step.food}
            product={step.product}
            overrides={book.overrides}
            offline={step.offline}
            note={note}
            busy={busy}
            onAdd={(unit, quantity) => addToLog(step.food, unit, quantity)}
            onSetPortion={(unit, grams) => book.setPortion(step.food, unit, grams)}
            onAddOwn={() => addProductToOwn(step.gtin, step.food)}
            onPhotoLabel={step.offline ? undefined : () => fresh(() => dispatch({ type: 'photoLabel' }))}
            onScanAnother={scanAnother}>
            {when}
          </ProductSheet>
        );
      case 'unknown':
      case 'queued': {
        const own = linkedOwn(step.gtin);
        return (
          <>
            <Card title={step.kind === 'queued' ? 'You’re offline' : 'We don’t know this product yet'}>
              <ThemedText type="bodyMedium">
                {step.kind === 'queued'
                  ? `We’ll look up ${step.code} when you’re back.`
                  : step.partial
                    ? `We found “${productTitle(step.partial.name, step.partial.brand)}”, but not what’s in it.`
                    : `Nobody has added ${step.code} yet.`}
              </ThemedText>
              {step.kind === 'unknown' && step.partial?.attribution ? <OffSource attribution={step.partial.attribution} /> : null}
              {step.kind === 'unknown' && step.canReadLabel ? (
                <>
                  <Button label="Photograph the nutrition label" icon="camera-outline" onPress={() => dispatch({ type: 'photoLabel' })} />
                  <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
                    We read the values from your photo, you check them, and the next person who scans it gets them straight away.
                  </ThemedText>
                </>
              ) : null}
              <Button variant="tonal" label="Add it yourself" icon="create-outline" onPress={() => dispatch({ type: 'addYourself' })} />
              <Button variant="text" label="Scan another" icon="barcode-outline" onPress={scanAnother} />
            </Card>
            {own ? ownPicker(ownFoodItem(own), scanAnother) : null}
          </>
        );
      }
      case 'label':
        return (
          <LabelCapture
            name={step.partial?.name}
            onPhoto={(b64) => photoTaken(step.gtin, step.code, b64)}
            onCancel={scanAnother}
            onManual={typeNumber}
          />
        );
      case 'confirm':
        return (
          <LabelConfirm
            label={step.label}
            knownName={step.partial}
            busy={busy}
            problem={problem}
            onShare={(form) => share(step, form)}
            onOwnOnly={(form) => ownOnly(step, form)}
            onRetake={() => fresh(() => dispatch({ type: 'photoLabel' }))}
          />
        );
      case 'own':
        return (
          <OwnFoodForm
            initialName={step.name}
            overrides={book.overrides}
            onCancel={scanAnother}
            onSave={async (own) => {
              if (await keepOwn(step.gtin, own)) await addToLog(ownFoodItem(own), 'serving', 1);
            }}>
            {when}
          </OwnFoodForm>
        );
      case 'problem': {
        const back = step.back;
        const code = 'gtin' in back ? back.code : null;
        const labelTrouble = back.kind === 'label';
        // A failed look-up is asked again for the same code; anything else goes back a step.
        const tryAgain = back.kind === 'looking' ? () => lookUp(back.gtin, back.code) : () => dispatch({ type: 'retry' });
        return (
          <Card>
            <Notice tone="problem" text={step.message} />
            <Button label={labelTrouble ? 'Photograph again' : 'Try again'} onPress={tryAgain} />
            {code && !labelTrouble ? (
              <Button variant="tonal" label="Add it yourself" icon="create-outline" onPress={() => dispatch({ type: 'addYourself' })} />
            ) : null}
            <Button variant="text" label="Type the number" icon="keypad-outline" onPress={typeNumber} />
          </Card>
        );
      }
    }
  };

  return (
    <Screen title="Scan a pack" onBack={onClose}>
      {body()}
      {problem && step.kind !== 'confirm' ? <Notice tone="problem" text={problem} /> : null}
    </Screen>
  );
}

function Waiting({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.waiting} accessibilityLiveRegion="polite">
      <ActivityIndicator color={theme.primary} />
      <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
});
