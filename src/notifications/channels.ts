/** Android notification channels and post options. No native code here, so jest can import it. */

export type ChannelId = 'nudges' | 'water' | 'nutrition' | 'weekly';

/** Where a tap goes: Journal → Water or Journal → Food. */
export type OpenTarget = 'water' | 'food';

export interface NotifyOptions {
  /** 'nudges' when left out. */
  channel?: ChannelId;
  open?: OpenTarget;
}

export interface ChannelSpec {
  id: ChannelId;
  name: string;
  importance: 'default' | 'low';
  /** Text hidden on the lock screen: health details stay private. */
  private: boolean;
}

export const CHANNELS: readonly ChannelSpec[] = [
  { id: 'nudges', name: 'Move reminders and goals', importance: 'default', private: false },
  { id: 'water', name: 'Water reminders', importance: 'default', private: false },
  { id: 'nutrition', name: 'Nutrient tips', importance: 'low', private: true },
  { id: 'weekly', name: 'Weekly summary', importance: 'low', private: true },
];
