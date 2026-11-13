import { Alert, Platform } from 'react-native';

/** A question waiting for an answer in the app's own dialog (components/confirm-host.tsx). */
export interface ConfirmRequest {
  title: string;
  message: string;
  action: string;
  onYes: () => void;
}

let present: ((request: ConfirmRequest) => void) | null = null;

/** ConfirmHost registers itself here; null when it unmounts. */
export function setConfirmPresenter(fn: ((request: ConfirmRequest) => void) | null) {
  present = fn;
}

/** Asks before a destructive action; `action` labels the confirming button. */
export function confirm(title: string, message: string, onYes: () => void, action = 'Delete') {
  if (present) {
    present({ title, message, action, onYes });
    return;
  }
  // Before the host is mounted: the platform's own dialog.
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
}

/** The same question for every journal entry, named as its Delete button names it: "Delete this reading?" */
export function confirmDelete(what: 'entry' | 'reading' | 'night' | 'mood', onYes: () => void) {
  confirm(`Delete this ${what}?`, "This can't be undone.", onYes);
}
