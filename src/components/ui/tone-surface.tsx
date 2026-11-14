import { createContext, type ReactNode, use } from 'react';

import { type ColorScheme, type DataTone, toneColors } from '@/constants/theme';

/**
 * Set by anything painted in a data tone's container colour (a filled tile, a
 * toned card, the 'block' hero). Text, icons, bars and tonal buttons inside
 * read it, so they draw in that container's `on` colour instead of the
 * surface ink, and bars run on the ground colour instead of the lane.
 */
export interface ToneInk {
  /** The container: the plate's own colour. */
  plate: string;
  /** Text and icons on the plate: the container's `on` colour (4.5:1, tested). */
  ink: string;
  /** The empty part of a bar on the plate. */
  lane: string;
  tone: DataTone;
}

export const ToneInkContext = createContext<ToneInk | null>(null);

/** Set by every Card, so a hero inside one doesn't draw a second plate. */
export const InCardContext = createContext(false);

export function useToneInk(): ToneInk | null {
  return use(ToneInkContext);
}

export function useInCard(): boolean {
  return use(InCardContext);
}

export function toneInk(theme: ColorScheme, tone: DataTone): ToneInk {
  const c = toneColors(theme, tone);
  return { plate: c.container, ink: c.onContainer, lane: theme.surface, tone };
}

/** Back on the plain ground: sheets and dialogs opened from inside a tile or card. */
export function PlainGround({ children }: { children: ReactNode }) {
  return (
    <ToneInkContext value={null}>
      <InCardContext value={false}>{children}</InCardContext>
    </ToneInkContext>
  );
}
