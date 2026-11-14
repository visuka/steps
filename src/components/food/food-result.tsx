import { useIsFocused } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { type ReactNode, use, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFoodResultCovering } from '@/components/food/food-result-cover';
import { Chip, NumberField, Button as OldButton, Stepper } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Button as UiButton, Chip as UiChip, Donut, IconCircle, NutrientRow, SpecIcon } from '@/components/ui';
import { donutColors } from '@/components/ui/donut-geometry';
import { MaxContentWidth, NumeralMaxScale, Spacing } from '@/constants/theme';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import { TELUGU_FONT } from '@/constants/themes/fonts';
import { useTheme } from '@/hooks/use-theme';
import { gramsFor, isSavedFoodId, nutrientsFor, type PortionOverrides, unitsFor } from '@/nutrition/catalog';
import { NUTRIENT } from '@/nutrition/nutrients';
import { PARTIAL_NOTE } from '@/nutrition/state';
import type { FoodItem, NutrientKey, Nutrients } from '@/nutrition/types';
import { glBand, glycemicIndex, type WatchOut, watchOuts } from '@/nutrition/watch';

import {
  FLAG_KEYS,
  gramsText,
  nutrientLabel,
  nutrientRowKeys,
  nutrientShare,
  nutrientText,
  portionText,
  spokenNutrientText,
} from './food-result-format';
import {
  contentUnderFooter,
  heroFits,
  ingredientIcon,
  ingredientLine,
  ingredientRowLayout,
  ingredientSpoken,
  ingredientSuffix,
  ingredientTitle,
  RESULT,
  titleLayout,
} from './food-result-layout';

export interface FoodResultProps {
  /** What the person typed, as typed ("endu chepala with egg curry"); left out for a food picked from a list. */
  query?: string | null;
  /** The same words in their own script when typed in Latin letters, or null. */
  script?: string | null;
  /** The food found for it, with its ingredients and partly known nutrients. */
  food: FoodItem;
  overrides: PortionOverrides;
  initialUnit?: string;
  initialQuantity?: number;
  /** The save button, e.g. "Save to lunch". */
  actionLabel: string;
  /** Saving is waiting on the server. */
  busy?: boolean;
  /** Open "How we worked this out" from the start, e.g. right after a recipe. */
  showWorking?: boolean;
  onDone: (unit: string, quantity: number, nutrients: Nutrients) => void;
  onCancel: () => void;
  onSetPortion: (unit: string, grams: number) => void;
  /** Extra controls under the preview, e.g. when it was eaten. */
  children?: ReactNode;
}

/**
 * The food result: what was typed, then the food found for it with its
 * portion, macros, ingredients and nutrients, and Save. One layout for every
 * look (spec 5.10); a look only changes its colours and fonts. Everything it
 * shows comes in through the props, so the design preview (app/design-preview.tsx)
 * draws it with the mockup's sample look-up: keep it free of data hooks.
 * "Edit" (or the portion chip) opens the portion, when it was eaten and the rest.
 */
export function FoodResult(props: FoodResultProps) {
  return <Result {...props} />;
}

/**
 * The food result as a whole screen, as on the mockup (a screen of its own on
 * the Food tab): the status-bar inset in the page colour, the result scrolling,
 * and Edit and Save fixed at the bottom so nothing hides under them. The design
 * preview renders exactly this; on the Food tab FoodLog shows it over the tab
 * (food-result-host.tsx).
 */
export function FoodResultScreen({ onBack, ...result }: FoodResultProps & { onBack?: () => void }) {
  return <Result {...result} screen onBack={onBack} />;
}

// ── state ────────────────────────────────────────────────────────────────

function useResultState(food: FoodItem, overrides: PortionOverrides, initialUnit?: string, initialQuantity?: number) {
  const units = unitsFor(food, overrides);
  const [unit, setUnit] = useState(initialUnit && units.some((u) => u.key === initialUnit) ? initialUnit : food.defaultUnit);
  const [quantity, setQuantity] = useState(initialQuantity ?? (unit === 'g' ? 100 : 1));
  const current = units.find((u) => u.key === unit) ?? units[0];
  const grams = gramsFor(food, unit, quantity, overrides);
  const n = nutrientsFor(food, unit, quantity, overrides);
  const missing = food.missing ?? [];
  const pickUnit = (key: string) => {
    setUnit(key);
    setQuantity(key === 'g' ? 100 : 1);
  };
  return { units, unit, current, quantity, setQuantity, pickUnit, grams, n, missing, watch: watchOuts(food, grams) };
}

type ResultState = ReturnType<typeof useResultState>;

/** The width the content has: the screen minus its two 24 margins, kept inside the widest column. */
function useContentWidth(): { width: number; fontScale: number } {
  const { width, fontScale } = useWindowDimensions();
  return { width: Math.min(width, MaxContentWidth) - 2 * RESULT.sideMargin, fontScale: Math.min(fontScale, NumeralMaxScale) };
}

// ── the result ───────────────────────────────────────────────────────────

function Result({
  screen,
  onBack,
  query,
  script,
  food,
  overrides,
  initialUnit,
  initialQuantity,
  actionLabel,
  busy,
  showWorking,
  onDone,
  onCancel,
  onSetPortion,
  children,
}: FoodResultProps & { screen?: boolean; onBack?: () => void }) {
  const theme = useTheme();
  const s = useResultState(food, overrides, initialUnit, initialQuantity);
  const [editing, setEditing] = useState(Boolean(showWorking));
  const [watchOpen, setWatchOpen] = useState<NutrientKey | null>(null);
  const insets = useSafeAreaInsets();
  // The tab bar carries the bottom inset, unless it has stepped aside for this result (food-result-cover.ts).
  const barHidden = useFoodResultCovering();
  const inTabs = use(BottomTabBarHeightContext) !== undefined && !barHidden;
  const back = onBack ?? onCancel;
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  const onScreen = useIsFocused();
  const [underFooter, setUnderFooter] = useState(false);
  const metrics = useRef({ content: 0, view: 0, y: 0 });
  const measure = (patch: Partial<typeof metrics.current>) => {
    Object.assign(metrics.current, patch);
    setUnderFooter(contentUnderFooter(metrics.current.content, metrics.current.view, metrics.current.y));
  };

  // System Back leaves the result, as the back arrow does, while its tab is in view.
  useEffect(() => {
    if (!screen || !onScreen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backRef.current();
      return true;
    });
    return () => sub.remove();
  }, [screen, onScreen]);

  const body = (
    <>
      <TopBar s={s} typed={Boolean(query)} onBack={back} onPortion={() => setEditing(!editing)} />
      <Title query={query} script={script} food={food} />
      <Hero s={s} />
      {editing ? (
        <Details s={s} food={food} showWorking={showWorking} onSetPortion={onSetPortion}>
          {children}
        </Details>
      ) : null}
      <Ingredients food={food} s={s} />
      <NutrientList s={s} open={watchOpen} onToggle={(k) => setWatchOpen(watchOpen === k ? null : k)} />
    </>
  );
  const footer = (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: theme.surface,
          paddingBottom: RESULT.footerBottom + (screen && !inTabs ? insets.bottom : 0),
          borderTopWidth: underFooter ? 1 : 0,
          borderTopColor: theme.outlineVariant,
        },
      ]}>
      <UiButton
        variant="secondary"
        label="Edit"
        disabled={busy}
        accessibilityLabel="Edit the portion and details"
        accessibilityHint={editing ? 'Hides the portion and details' : 'Shows the portion and details'}
        onPress={() => setEditing(!editing)}
        style={styles.edit}
      />
      <UiButton label={actionLabel} disabled={busy} onPress={() => onDone(s.unit, s.quantity, s.n)} style={styles.save} />
    </View>
  );

  if (!screen) {
    // Inline (no screen of its own): the same parts in one column.
    return (
      <View style={[styles.inline, { backgroundColor: theme.surface }]}>
        <View style={styles.inlineBody}>{body}</View>
        {footer}
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.surface, paddingTop: insets.top }]}>
      <ScrollView
        style={styles.fill}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onLayout={(e) => measure({ view: e.nativeEvent.layout.height })}
        onContentSizeChange={(_w, h) => measure({ content: h })}
        onScroll={(e) => measure({ y: e.nativeEvent.contentOffset.y })}>
        <View style={styles.column}>{body}</View>
      </ScrollView>
      <View style={styles.footerWrap}>{footer}</View>
    </View>
  );
}

// ── top bar and title ────────────────────────────────────────────────────

const same = (x: string, y: string) => x.trim().toLowerCase() === y.trim().toLowerCase();

function TopBar({ s, typed, onBack, onPortion }: { s: ResultState; typed: boolean; onBack: () => void; onPortion: () => void }) {
  const theme = useTheme();
  const portion = portionText(s.quantity, s.unit, s.current.label);
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={{ top: 4, bottom: 4, left: 14, right: 14 }}
        style={styles.back}>
        <SpecIcon name="chevron-left" color={theme.onSurface} />
        {typed ? (
          <ThemedText
            type="bodySmall"
            themeColor="onSurfaceVariant"
            maxFontSizeMultiplier={NumeralMaxScale}
            accessibilityElementsHidden
            importantForAccessibility="no">
            You typed
          </ThemedText>
        ) : null}
      </Pressable>
      <UiChip label={portion} trailingIcon="chevron-down" onPress={onPortion} accessibilityLabel={`Portion: ${portion}. Change it`} />
    </View>
  );
}

/** The dish as typed (case kept, wraps, never cut), the same words in their own script, and the food found when it is named differently. */
function Title({ query, script, food }: { query?: string | null; script?: string | null; food: FoodItem }) {
  const theme = useTheme();
  const { width, fontScale } = useContentWidth();
  const typed = query || food.name;
  // A look-up can find a food named differently from what was typed ("2 idli and sambar" → Idli): name it too.
  const found = query && !same(query, food.name) ? food.name : null;
  const lines = titleLayout(typed, width, fontScale);
  return (
    <View
      style={[styles.title, { minHeight: lines.height }]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={[query ? `You typed ${query}` : food.name, script, found].filter(Boolean).join('. ')}>
      <ThemedText type="headlineSmall" maxFontSizeMultiplier={NumeralMaxScale}>
        {typed}
      </ThemedText>
      {script ? (
        <Text style={[styles.telugu, { color: theme.onSurfaceVariant }]} maxFontSizeMultiplier={NumeralMaxScale}>
          {script}
        </Text>
      ) : null}
      {found ? (
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale}>
          {found}
        </ThemedText>
      ) : null}
    </View>
  );
}

// ── hero: energy, macros, donut ──────────────────────────────────────────

const MACROS = [
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'fat', label: 'Fat' },
] as const;

function Hero({ s }: { s: ResultState }) {
  const theme = useTheme();
  const dots = donutColors(theme);
  const least = (k: NutrientKey) => s.missing.includes(k);
  const kcal = nutrientText('kcal', s.n.kcal ?? 0, least('kcal'), false);
  const portion = portionText(s.quantity, s.unit, s.current.label);
  const spoken = `${portion}, ${spokenNutrientText('kcal', s.n.kcal ?? 0, least('kcal'))}`;
  const { width, fontScale } = useContentWidth();
  const macroTexts = MACROS.map((m) => {
    const v = s.n[m.key];
    return v === undefined ? '—' : nutrientText(m.key, v, least(m.key));
  });
  // Wrap, never shrink: the donut drops below the text when the number is too wide beside it.
  const fit = heroFits(width, fontScale, kcal, macroTexts);
  return (
    <View style={[styles.hero, fit.stacked && styles.heroStacked, { backgroundColor: theme.foodContainer }]}>
      <View style={fit.stacked ? styles.heroLeftFull : styles.heroLeft}>
        <View accessible accessibilityLabel={spoken} style={styles.baseline}>
          <ThemedText type="numeralLarge" maxFontSizeMultiplier={NumeralMaxScale}>
            {kcal}
          </ThemedText>
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale}>
            kcal
          </ThemedText>
        </View>
        <View style={styles.macros}>
          {MACROS.map((m, i) => {
            const v = s.n[m.key];
            return (
              <View
                key={m.key}
                accessible
                accessibilityLabel={`${m.label} ${v === undefined ? 'not known' : spokenNutrientText(m.key, v, least(m.key))}`}
                style={{ minWidth: RESULT.macroColumns[i] }}>
                <View style={styles.macroValue}>
                  <View style={[styles.dot, { backgroundColor: dots[i] }]} />
                  <ThemedText type="labelLarge" maxFontSizeMultiplier={NumeralMaxScale}>
                    {macroTexts[i]}
                  </ThemedText>
                </View>
                <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale}>
                  {m.label}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>
      <Donut protein={s.n.protein ?? 0} carbs={s.n.carbs ?? 0} fat={s.n.fat ?? 0}>
        <SpecIcon name="bowl" color={theme.food} />
      </Donut>
    </View>
  );
}

// ── ingredients ──────────────────────────────────────────────────────────

function Ingredients({ food, s }: { food: FoodItem; s: ResultState }) {
  const theme = useTheme();
  const { width, fontScale } = useContentWidth();
  const list = food.ingredients ?? [];
  if (!list.length) return null;
  // Ingredients are given for the food's first unit (a recipe's one serving).
  const per = food.units[0];
  const perOther = per && !(s.unit === per.key && s.quantity === 1) ? ` · in 1 ${per.label}` : '';
  return (
    <View style={styles.ingredients}>
      <View style={styles.sectionRow}>
        <ThemedText type="labelLarge" accessibilityRole="header" maxFontSizeMultiplier={NumeralMaxScale} style={styles.shrink}>
          Ingredients{perOther}
        </ThemedText>
        {food.pending ? (
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale} style={styles.pendingNote}>
            Some ingredients still being added
          </ThemedText>
        ) : null}
      </View>
      {list.map((ing, index) => {
        const line = ingredientLine(ing.name);
        const grams = gramsText(ing.grams);
        const last = index === list.length - 1;
        const layout = ingredientRowLayout(`${ingredientTitle(line)}${ingredientSuffix(line)}`, grams, width, fontScale);
        return (
          <View key={`${ing.name}-${index}`} style={styles.ingRow} accessible accessibilityLabel={`${ingredientSpoken(line)}, ${grams}`}>
            <IconCircle name={ingredientIcon(ing.name)} tone="warm" />
            <View
              style={[
                styles.ingPart,
                { minHeight: layout.minHeight },
                last ? null : { borderBottomWidth: 1, borderBottomColor: theme.outlineVariant },
              ]}>
              <ThemedText
                type="bodyMedium"
                numberOfLines={RESULT.ingredientMaxLines}
                ellipsizeMode="tail"
                maxFontSizeMultiplier={NumeralMaxScale}
                style={styles.shrink}>
                {ingredientTitle(line)}
                <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale}>
                  {ingredientSuffix(line)}
                </ThemedText>
              </ThemedText>
              <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale}>
                {grams}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── nutrients ────────────────────────────────────────────────────────────

function NutrientList({ s, open, onToggle }: { s: ResultState; open: NutrientKey | null; onToggle: (key: NutrientKey) => void }) {
  const [all, setAll] = useState(false);
  const flags = s.watch.filter(
    (w): w is WatchOut & { key: NutrientKey } => w.key !== 'deep-fried' && FLAG_KEYS.includes(w.key) && s.n[w.key] !== undefined,
  );
  const { first, rest } = nutrientRowKeys(
    s.n,
    flags.map((f) => f.key),
  );
  const note = s.missing.length ? PARTIAL_NOTE : null;
  if (!first.length) {
    return note ? (
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale} style={styles.nutrients}>
        {note}
      </ThemedText>
    ) : null;
  }
  const least = (k: NutrientKey) => s.missing.includes(k);
  const shown = all ? [...first, ...rest] : first;
  const atLeast = shown.some(least);
  const row = (k: NutrientKey) => {
    const level = flags.find((f) => f.key === k)?.level;
    // The "High" pill is the warning styling; a flag of level medium keeps a plain row (the pill can only say High).
    const high = level === 'high';
    const line = (
      <NutrientRow
        name={nutrientLabel(k)}
        value={nutrientText(k, s.n[k]!, least(k))}
        share={nutrientShare(k, s.n[k]!)}
        warn={high}
        pill={high}
      />
    );
    if (!level) return <View key={k}>{line}</View>;
    return (
      <View key={k}>
        <Pressable
          onPress={() => onToggle(k)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open === k }}
          accessibilityHint="Says why it matters">
          {line}
        </Pressable>
        {open === k ? (
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale}>
            {`This amount: ${spokenNutrientText(k, s.n[k]!, least(k))}. ${NUTRIENT[k].note}`}
          </ThemedText>
        ) : null}
      </View>
    );
  };
  return (
    <View style={styles.nutrients}>
      <View style={styles.nutrientsHead}>
        <ThemedText type="labelLarge" accessibilityRole="header" maxFontSizeMultiplier={NumeralMaxScale}>
          Nutrients
        </ThemedText>
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale} style={styles.shrink}>
          {atLeast ? 'at least · ' : ''}bar shows % of daily need
        </ThemedText>
      </View>
      <View style={styles.nutrientGroup}>{shown.map(row)}</View>
      {rest.length ? (
        <UiButton variant="text" compact label={all ? 'Show fewer nutrients' : 'Show all nutrients'} onPress={() => setAll(!all)} style={styles.showAll} />
      ) : null}
      {/* "at least" in the caption already says it; the note is for a list with no "≥" row (spec 5.10). */}
      {note && !atLeast ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale}>
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

// ── Edit: the portion and the rest of the details ────────────────────────

function Details({
  s,
  food,
  showWorking,
  onSetPortion,
  children,
}: {
  s: ResultState;
  food: FoodItem;
  showWorking?: boolean;
  onSetPortion: (unit: string, grams: number) => void;
  children?: ReactNode;
}) {
  const [editingSize, setEditingSize] = useState(false);
  const [size, setSize] = useState<number | null>(null);
  const [working, setWorking] = useState(Boolean(showWorking));
  const [watchOpen, setWatchOpen] = useState<WatchOut['key'] | null>(null);
  const isGrams = s.unit === 'g';
  const own = food.category === 'own';
  const gi = glycemicIndex(food);
  const hasWorking = isSavedFoodId(food.id) || Boolean(food.ingredients?.length || food.notes?.length);
  const least = (k: NutrientKey) => (s.missing.includes(k) ? 'at least ' : '');
  const workingUnit = food.units[0];
  // Watch-outs the nutrient list doesn't flag (fat, deep-fried), with their notes.
  const others = s.watch.filter((w) => w.key === 'deep-fried' || !FLAG_KEYS.includes(w.key));
  const openWatch = others.find((w) => w.key === watchOpen);
  const watchNote = (w: WatchOut) => {
    if (w.key === 'deep-fried') return DEEP_FRIED_NOTE;
    const amount = s.n[w.key];
    return `${amount === undefined ? '' : `This amount: ${least(w.key)}${spokenNutrientText(w.key, amount, false)}. `}${NUTRIENT[w.key].note}`;
  };

  return (
    <View style={styles.panel}>
      <ThemedText type="labelLarge" accessibilityRole="header" maxFontSizeMultiplier={NumeralMaxScale}>
        Portion
      </ThemedText>
      {s.units.length > 1 ? (
        <View style={styles.chips}>
          {s.units.map((u) => (
            <Chip key={u.key} label={u.label} selected={u.key === s.unit} onPress={() => s.pickUnit(u.key)} />
          ))}
        </View>
      ) : null}
      {isGrams ? (
        <NumberField label="Amount" unit="g" value={s.quantity} onCommit={(v) => s.setQuantity(v && v > 0 ? v : 1)} />
      ) : (
        <Stepper
          value={s.quantity}
          onChange={s.setQuantity}
          step={0.5}
          min={0.5}
          max={20}
          format={(q) => `${Number.isInteger(q) ? q : q.toFixed(1)} × ${s.current.label}`}
        />
      )}
      {own ? null : (
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(s.grams)} g in all
        </ThemedText>
      )}
      {!isGrams && !own ? (
        editingSize ? (
          <View style={styles.section}>
            <NumberField label={`For me, 1 ${s.current.label} is`} unit="g" value={size ?? s.current.grams} onCommit={setSize} />
            <ThemedText type="small" themeColor="textSecondary">
              This updates your past entries of {food.name.toLowerCase()} too.
            </ThemedText>
            <OldButton
              kind="secondary"
              label="Save portion size"
              disabled={!size || size <= 0}
              onPress={() => {
                if (size && size > 0) onSetPortion(s.unit, size);
                setEditingSize(false);
              }}
            />
          </View>
        ) : (
          <View style={styles.inlineRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.shrink}>
              1 {s.current.label} = {s.current.grams} g
            </ThemedText>
            <UiButton
              variant="text"
              compact
              label="Change"
              accessibilityLabel={`Change the size of 1 ${s.current.label}`}
              onPress={() => setEditingSize(true)}
            />
          </View>
        )
      ) : null}

      {children}

      {others.length ? (
        <View style={styles.chips}>
          {others.map((w) => (
            <Chip key={w.key} label={w.text} selected={watchOpen === w.key} onPress={() => setWatchOpen(watchOpen === w.key ? null : w.key)} />
          ))}
        </View>
      ) : null}
      {openWatch ? (
        <ThemedText type="small" themeColor="textSecondary">
          {watchNote(openWatch)}
        </ThemedText>
      ) : null}
      {gi !== null && s.n.gl !== undefined ? (
        <ThemedText type="small" themeColor="textSecondary">
          GI about {gi} · glycemic load {least('carbs')}
          {Math.round(s.n.gl)} for this amount: {glBand(s.n.gl, 'portion')}
        </ThemedText>
      ) : null}

      {hasWorking ? (
        <>
          <UiButton
            variant="text"
            compact
            icon={working ? 'chevron-up' : 'chevron-down'}
            label={working ? 'Hide how we worked this out' : 'How we worked this out'}
            onPress={() => setWorking(!working)}
          />
          {working ? (
            <View style={styles.section}>
              {food.ingredients?.length && workingUnit ? (
                <ThemedText type="small" themeColor="textSecondary">
                  The ingredients are for 1 {workingUnit.label}
                  {workingUnit.key === 'g' ? '' : ` (${Math.round(workingUnit.grams)} g)`}.
                </ThemedText>
              ) : null}
              {food.notes?.map((line, index) => (
                <ThemedText key={`note-${index}`} type="small" themeColor="textSecondary">
                  {line}
                </ThemedText>
              ))}
              <ThemedText type="small" themeColor="textSecondary">
                Nutrients are added up from each ingredient, not guessed. They are estimates.
              </ThemedText>
            </View>
          ) : null}
        </>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {food.source}
      </ThemedText>
    </View>
  );
}

const DEEP_FRIED_NOTE = 'Cooked in a lot of hot oil, so it soaks some up: more fat and calories than the same food made another way.';

const styles = StyleSheet.create({
  fill: { flex: 1 },
  inline: { borderRadius: CLEAN_SPEC.radius.card, overflow: 'hidden' },
  inlineBody: { paddingBottom: Spacing.three },
  scrollContent: { alignItems: 'center', paddingHorizontal: RESULT.sideMargin, paddingTop: RESULT.topGap, paddingBottom: Spacing.three },
  column: { width: '100%', maxWidth: MaxContentWidth },
  topBar: { minHeight: RESULT.topBarHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // The chevron's left edge sits at x = 20: margin-left -4 on the 24 margin.
  back: { minHeight: RESULT.topBarHeight, flexDirection: 'row', alignItems: 'center', gap: CLEAN_SPEC.space.s8, marginLeft: -4 },
  title: { marginTop: RESULT.titleGap },
  telugu: {
    fontFamily: TELUGU_FONT,
    fontSize: CLEAN_SPEC.type.telugu.size,
    lineHeight: CLEAN_SPEC.type.telugu.lineHeight,
  },
  hero: {
    marginTop: RESULT.heroGap,
    minHeight: RESULT.heroMinHeight,
    borderRadius: CLEAN_SPEC.radius.hero,
    paddingVertical: RESULT.heroPaddingV,
    paddingHorizontal: RESULT.heroPaddingH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: CLEAN_SPEC.space.s8,
  },
  heroStacked: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' },
  heroLeft: { flexShrink: 1 },
  heroLeftFull: { alignSelf: 'stretch' },
  baseline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: CLEAN_SPEC.space.s8 },
  macros: { flexDirection: 'row', flexWrap: 'wrap', rowGap: CLEAN_SPEC.space.s8, marginTop: CLEAN_SPEC.space.s8 },
  macroValue: { flexDirection: 'row', alignItems: 'center', gap: RESULT.macroDotGap },
  dot: { width: RESULT.macroDot, height: RESULT.macroDot, borderRadius: CLEAN_SPEC.radius.dot },
  ingredients: { marginTop: RESULT.ingredientsGap },
  // "Nutrients" with its caption right after it (spec 5.10: a row, gap 8, baseline).
  nutrientsHead: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: CLEAN_SPEC.space.s8 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: CLEAN_SPEC.space.s8 },
  pendingNote: { flexShrink: 1, textAlign: 'right' },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: RESULT.ingredientGap },
  ingPart: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: RESULT.ingredientGap, paddingVertical: 4 },
  nutrients: { marginTop: RESULT.nutrientsGap },
  nutrientGroup: { marginTop: RESULT.nutrientGroupTop },
  showAll: { minHeight: RESULT.showAllHeight, alignSelf: 'flex-start' },
  panel: { marginTop: Spacing.three, gap: Spacing.three },
  footerWrap: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  footer: {
    flexDirection: 'row',
    gap: RESULT.buttonGap,
    paddingTop: RESULT.footerTop,
    paddingHorizontal: RESULT.sideMargin,
  },
  edit: { width: RESULT.editWidth },
  save: { flex: 1 },
  shrink: { flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  section: { gap: Spacing.two },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
