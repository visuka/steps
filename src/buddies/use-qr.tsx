/**
 * Buddies QR codes, the hooks the QR screens use. The API comes from
 * BuddiesSource (use-buddies.tsx), so the design preview swaps in sample
 * data; views never call the API or the repo. The rules live in
 * qr/club-code.ts and clubs.ts.
 */
import { useCallback, useEffect, useState } from 'react';

import { useApp } from '@/state/app-state';

import { clubErrorText, joinOrAccept } from './clubs';
import { CLUB_CODES_KEY, liveCode, readSavedCodes, withCode } from './qr/club-code';
import type { ClubCard, ClubCode } from './types';
import { useSocialApi } from './use-buddies';

/**
 * The club's QR code for its captain and vice-captains, while `open`: the
 * code I made last while it has time left (so a code already shared keeps
 * working), else a new one. New code replaces it (the old one stops working).
 */
export function useClubQr(clubId: string, open: boolean) {
  const api = useSocialApi();
  const { repo } = useApp();
  const [code, setCode] = useState<ClubCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const make = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const fresh = await api.newClubCode(clubId);
      const saved = readSavedCodes(await repo.getKv(CLUB_CODES_KEY).catch(() => null));
      await repo.setKv(CLUB_CODES_KEY, withCode(saved, clubId, fresh, Date.now())).catch(() => undefined);
      setCode(fresh);
    } catch (e) {
      setError(clubErrorText(e));
    } finally {
      setBusy(false);
    }
  }, [api, repo, clubId]);

  useEffect(() => {
    if (!open || !clubId) return;
    let live = true;
    void repo
      .getKv(CLUB_CODES_KEY)
      .catch(() => null)
      .then((v) => {
        if (!live) return;
        const saved = liveCode(readSavedCodes(v), clubId, Date.now());
        if (saved) setCode(saved);
        else void make();
      });
    return () => {
      live = false;
    };
  }, [open, clubId, repo, make]);

  return { code, busy, error, renew: make };
}

type Found = { code: string; card: ClubCard | null; error: string | null };

/**
 * A club found by its join code (a scan, a link or a typed code): the card
 * (works for hidden clubs), and joining with the code. A club with shared
 * goals sends nothing until the person agrees on the consent screen.
 */
export function useClubByCode(code: string | null) {
  const api = useSocialApi();
  const [found, setFound] = useState<Found | null>(null);

  useEffect(() => {
    if (!code) return;
    let live = true;
    api.clubByCode(code).then(
      (card) => live && setFound({ code, card, error: null }),
      (e: unknown) => live && setFound({ code, card: null, error: clubErrorText(e) }),
    );
    return () => {
      live = false;
    };
  }, [api, code]);

  const current = found && found.code === code ? found : null;
  const card = current?.card ?? null;

  /** Ask to join (or accept an invite) with the code; `consent` from the goals consent screen. */
  const join = useCallback(
    async (consent = false): Promise<{ err: string | null; state: 'asked' | 'member' | 'needs_consent' | null }> => {
      if (!card || !code) return { err: null, state: null };
      try {
        const state = await joinOrAccept(api, card, { consent, code });
        if (state !== 'needs_consent') setFound({ code, card: { ...card, myState: state }, error: null });
        return { err: null, state };
      } catch (e) {
        return { err: clubErrorText(e), state: null };
      }
    },
    [api, card, code],
  );

  return { card, error: current?.error ?? null, loading: !!code && !current, join };
}
