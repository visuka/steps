import { StyleSheet } from 'react-native';

import { ListRow, Notice, Screen, Surface } from '@/components/ui';

/** What the Plus tab will hold. Each opens its own screen once walk buddies are switched on. */
export const PLUS_ROWS = [
  { key: 'chats', title: 'Chats', supporting: 'Talk with your walk buddies', icon: 'chatbubbles-outline' },
  { key: 'groups', title: 'Groups and clubs', supporting: 'Walk and cycle together', icon: 'people-outline' },
  { key: 'buddies', title: 'Walk buddies', supporting: 'Find people to walk with', icon: 'walk-outline' },
  { key: 'plans', title: 'Walk plans', supporting: 'Pick a time and place to meet', icon: 'calendar-outline' },
  { key: 'qr', title: 'Add by QR code', supporting: 'Scan to add a buddy or join a club', icon: 'qr-code-outline' },
] as const;

/** The bar's plus: chats, groups and clubs, and the people you walk with. */
export default function PlusTab() {
  return (
    <Screen title="Chats and groups">
      <Notice text="Chats and groups are coming in the next builds." />
      <Surface level={1} style={styles.list}>
        {PLUS_ROWS.map((r) => (
          <ListRow key={r.key} icon={r.icon} title={r.title} supporting={r.supporting} disabled />
        ))}
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden' },
});
