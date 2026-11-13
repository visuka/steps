import { Redirect } from 'expo-router';

/** Old address of the Goals tab, kept for links: the goal and badges now live in You. */
export default function GoalsLink() {
  return <Redirect href="/you" />;
}
