import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { ListRow, Sheet } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countryChoices, countryName } from '@/lib/country';

/**
 * Settings → Country: "From your phone" first, then the common countries
 * (lib/country.ts countryChoices); typing finds any. Picking one closes the sheet.
 */
export function CountrySheet({
  visible,
  value,
  detected,
  onPick,
  onClose,
}: {
  visible: boolean;
  /** The saved choice; null = from the phone. */
  value: string | null;
  /** What the phone's time zone says, or null. */
  detected: string | null;
  onPick: (code: string | null) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const typed = query.trim() !== '';
  const found = countryChoices(query, value, detected);
  const check = <Ionicons name="checkmark" size={22} color={theme.primary} />;
  const close = () => {
    setQuery('');
    onClose();
  };
  const pick = (code: string | null) => {
    setQuery('');
    onPick(code);
  };

  return (
    <Sheet visible={visible} onClose={close} title="Country">
      <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
        Dishes are worked out the way they’re usually made here.
      </ThemedText>
      <TextField label="Search countries" value={query} onChangeText={setQuery} placeholder="Search" maxLength={40} />
      <View style={styles.list}>
        {typed ? null : (
          <ListRow
            icon="phone-portrait-outline"
            title="From your phone"
            supporting={countryName(detected) ?? 'Not known: India is assumed'}
            trailing={value === null ? check : undefined}
            onPress={() => pick(null)}
            accessibilityLabel={`From your phone, ${countryName(detected) ?? 'not known'}${value === null ? ', selected' : ''}`}
          />
        )}
        {found.map((c) => (
          <ListRow
            key={c.code}
            title={c.name}
            trailing={value === c.code ? check : undefined}
            onPress={() => pick(c.code)}
            accessibilityLabel={value === c.code ? `${c.name}, selected` : c.name}
          />
        ))}
        {typed ? null : (
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.none}>
            Not here? Search for any country.
          </ThemedText>
        )}
        {found.length ? null : (
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.none}>
            No country called that.
          </ThemedText>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { marginHorizontal: -Spacing.four },
  none: { paddingHorizontal: Spacing.four },
});
