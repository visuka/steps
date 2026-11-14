import { createContext, type ReactNode, use, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Lets the food log (deep inside the Food tab's scrolling screen) show the
 * food result as a screen of its own over the tab, as on the mockups, with
 * the navigation bar still under it. The log keeps its state; it hands its
 * result element to the host on every render, and only the layer re-renders.
 */
export interface FoodResultHost {
  get: () => ReactNode | null;
  set: (node: ReactNode | null) => void;
  subscribe: (listener: () => void) => () => void;
}

function createHost(): FoodResultHost {
  let node: ReactNode | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => node,
    set: (next) => {
      node = next;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const HostContext = createContext<FoodResultHost | null>(null);

/**
 * Wraps a tab screen: `children` is the screen, hidden from the screen
 * reader while a result covers it.
 */
export function FoodResultHostView({ children }: { children: ReactNode }) {
  const [host] = useState(createHost);
  const covering = useSyncExternalStore(host.subscribe, () => host.get() !== null);
  return (
    <HostContext value={host}>
      <View style={styles.fill}>
        <View
          style={styles.fill}
          importantForAccessibility={covering ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={covering}>
          {children}
        </View>
        <Layer host={host} />
      </View>
    </HostContext>
  );
}

function Layer({ host }: { host: FoodResultHost }) {
  const node = useSyncExternalStore(host.subscribe, host.get);
  if (node === null) return null;
  return <View style={StyleSheet.absoluteFill}>{node}</View>;
}

/** True inside a FoodResultHostView. */
export function useHasFoodResultHost(): boolean {
  return use(HostContext) !== null;
}

/**
 * Shows `node` over the screen while it is not null (null clears it). Returns
 * false when there is no host around, so the caller draws it in place.
 */
export function useFoodResultLayer(node: ReactNode | null): boolean {
  const host = use(HostContext);
  useLayoutEffect(() => {
    host?.set(node);
  });
  useLayoutEffect(() => () => host?.set(null), [host]);
  return host !== null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
