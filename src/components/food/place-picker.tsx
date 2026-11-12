import { StyleSheet, View } from 'react-native';

import { Chip, TextField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { FoodPlace } from '@/data/types';
import { cleanRestaurant, PLACES, RESTAURANT_MAX, restaurantKey } from '@/nutrition/place';

/** What the person has picked and typed so far. The restaurant is cleaned when used, so spaces can be typed. */
export interface PlaceInput {
  place: FoodPlace;
  restaurant: string;
}

/**
 * "Where was it from?": home-made (the default), dine-in or ordered in, and
 * for the last two which restaurant, if they want to say. Restaurant food
 * usually has more oil and salt, so the answer changes the numbers.
 */
export function PlacePicker({
  value,
  onChange,
  restaurants,
  note,
}: {
  value: PlaceInput;
  onChange: (next: PlaceInput) => void;
  /** Recently named restaurants, offered as one-tap chips. */
  restaurants: string[];
  /** A line under the choices, e.g. that the answer means a look-up. */
  note?: string | null;
}) {
  const typed = cleanRestaurant(value.restaurant);
  return (
    <View style={styles.wrap}>
      <ThemedText type="small">Where was it from?</ThemedText>
      <View style={styles.chips}>
        {PLACES.map((p) => (
          <Chip
            key={p.value}
            label={p.label}
            selected={value.place === p.value}
            onPress={() => onChange({ ...value, place: p.value })}
          />
        ))}
      </View>
      {value.place !== 'home' ? (
        <>
          <TextField
            label="Which restaurant? (optional)"
            value={value.restaurant}
            onChangeText={(restaurant) => onChange({ ...value, restaurant })}
            placeholder="Which restaurant? (optional)"
            maxLength={RESTAURANT_MAX}
          />
          {restaurants.length ? (
            <View style={styles.chips}>
              {restaurants.map((r) => {
                const selected = typed !== null && restaurantKey(typed) === restaurantKey(r);
                return (
                  <Chip
                    key={r}
                    label={r}
                    selected={selected}
                    onPress={() => onChange({ ...value, restaurant: selected ? '' : r })}
                  />
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
