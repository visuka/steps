import * as Location from 'expo-location';

export async function locationAllowed(): Promise<boolean> {
  try {
    return (await Location.getForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Asks for location while the app is in use. Never asks for background access. */
export async function requestLocation(): Promise<boolean> {
  try {
    return (await Location.requestForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** False when the person allowed only an approximate location (Android 12+), which makes routes rough. */
export async function preciseLocationAllowed(): Promise<boolean> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    return p.granted && p.android?.accuracy !== 'coarse';
  } catch {
    return false;
  }
}

/** A short area name such as "Koramangala", from the phone's own geocoder. */
export async function placeName(lat: number, lon: number): Promise<string | null> {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    return address?.district ?? address?.city ?? address?.subregion ?? address?.name ?? null;
  } catch {
    // Not available on the web, or the geocoder is offline.
    return null;
  }
}
