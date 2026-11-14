import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { confirm } from '@/components/confirm';
import { PremiumGate } from '@/components/premium-gate';
import { EmptyState, Screen } from '@/components/ui';
import { WalkDetailLook } from '@/components/walk/walk-detail-look';
import type { PartChoice, Walk, WalkPart } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import type { WalkPoint } from '@/lib/walk';
import { SCREEN_FEATURES } from '@/premium/premium';
import { useApp } from '@/state/app-state';
import { choosePart, refreshWalkSteps } from '@/walks/save';

export default function WalkDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WalkDetail id={id} />;
}

/**
 * One walk's screen, read from the repository by id. The design preview
 * (app/design-preview.tsx) renders this with the sample walk's id over its
 * sample repository: keep it a component that takes only the id.
 */
export function WalkDetail({ id }: { id: string }) {
  const router = useRouter();
  return (
    <PremiumGate feature={SCREEN_FEATURES['walk/[id]']} title="Walk" onBack={() => router.back()}>
      <WalkDetailScreen id={id} />
    </PremiumGate>
  );
}

function WalkDetailScreen({ id }: { id: string }) {
  const { repo, source, profile, touch } = useApp();
  const router = useRouter();
  const theme = useTheme();
  const [walk, setWalk] = useState<Walk | null>(null);
  const [points, setPoints] = useState<WalkPoint[]>([]);
  const [parts, setParts] = useState<WalkPart[]>([]);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [found, foundParts] = await Promise.all([repo.getWalk(id), repo.getWalkParts(id)]);
        if (!live) return;
        if (!found) {
          setMissing(true);
          return;
        }
        setWalk(found.walk);
        setPoints(found.points);
        setParts(foundParts);
        try {
          const updated = await refreshWalkSteps(repo, source, profile, found.walk, found.points);
          if (live && updated !== found.walk) setWalk(updated);
        } catch {
          // The walk is already on screen; a step recount that fails keeps the stored count.
        }
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [repo, source, profile, id, attempt]);

  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  const answer = async (ord: number, choice: PartChoice | null) => {
    if (!walk) return;
    setBusy(ord);
    try {
      const updated = await choosePart(repo, walk.id, ord, choice);
      const fresh = await repo.getWalkParts(walk.id);
      if (updated) setWalk(updated);
      setParts(fresh);
      touch();
    } finally {
      setBusy(null);
    }
  };

  const what = walk?.activity === 'ride' ? 'ride' : 'walk';
  const remove = () =>
    confirm(`Delete this ${what}?`, 'Its route and stats will be removed. Your step counts stay.', async () => {
      await repo.deleteWalk(id);
      touch();
      router.back();
    });

  if (!walk) {
    // While it loads, the bare page; if it is gone or could not be read, a line saying so.
    if (failed) {
      return (
        <Screen title="Walk" onBack={() => router.back()}>
          <EmptyState
            icon="alert-circle-outline"
            title="Could not open this"
            hint="Something went wrong reading it."
            action={{ label: 'Try again', onPress: retry }}
          />
        </Screen>
      );
    }
    if (!missing) return <View style={[styles.flex, { backgroundColor: theme.surface }]} />;
    return (
      <Screen title="Walk" onBack={() => router.back()}>
        <EmptyState icon="trash-outline" title="This was deleted" />
      </Screen>
    );
  }

  return (
    <WalkDetailLook
      walk={walk}
      points={points}
      parts={parts}
      units={profile.units}
      busy={busy !== null}
      onAnswer={answer}
      onDelete={remove}
      onBack={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
