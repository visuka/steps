import { Alert, Platform } from 'react-native';

/** Asks before a destructive action; `action` labels the confirming button. */
export function confirm(title: string, message: string, onYes: () => void, action = 'Delete') {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
}
