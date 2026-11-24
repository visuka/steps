/**
 * The phone's date and time dialogs for the Plan a walk form. Android only:
 * the web preview has none (open-picker.web.ts), and the chips still work.
 */
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

import type { OpenPicker } from '@/lib/when';

export const openPicker: OpenPicker | null = Platform.OS === 'android' ? (options) => DateTimePickerAndroid.open(options) : null;
