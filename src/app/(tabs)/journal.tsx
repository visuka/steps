import { Redirect, useLocalSearchParams } from 'expo-router';

/** The Journal is now part of other tabs: food entries are on Food, health readings on Activity. Old links land there. */
export default function JournalRedirect() {
  const params = useLocalSearchParams<{ section?: string; n?: string }>();
  if (params.section === 'food') return <Redirect href="/food" />;
  return (
    <Redirect
      href={{ pathname: '/activity', params: { section: params.section ?? 'heart', ...(params.n ? { n: params.n } : {}) } }}
    />
  );
}
