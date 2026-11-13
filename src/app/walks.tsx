import { Redirect } from 'expo-router';

/** Old address of the Walks tab, kept for links and bookmarks: walks now live in Activity. */
export default function WalksLink() {
  return <Redirect href="/activity" />;
}
