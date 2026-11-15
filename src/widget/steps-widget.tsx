'use no memo';
// Android home-screen widget. Rendered to native RemoteViews by
// react-native-android-widget, so only its widget primitives work here.
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { ActiveTheme } from '@/constants/theme';
import { dayKey } from '@/lib/dates';
import { formatSteps } from '@/lib/format';

export interface WidgetData {
  /** The day the steps are for; older saves don't have it. */
  date?: string;
  steps: number;
  goal: number;
  updatedAt: number;
}

/** The widget sits on the home screen: the chosen look's dark colours (its only colours if it is light-only). */
const W = ActiveTheme.colors.dark;

function ringSvg(progress: number) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const filled = Math.min(1, progress) * c;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${W.surfaceContainerHighest}" stroke-width="10"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${W.primary}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${filled} ${c}" transform="rotate(-90 50 50)"/>
  </svg>`;
}

export function StepsWidget({ data }: { data: WidgetData | null }) {
  // Steps saved on an earlier day aren't today's: show none until the app syncs again.
  const savedFor = data?.date ?? (data ? dayKey(new Date(data.updatedAt)) : null);
  const isToday = savedFor === dayKey(new Date());
  const steps = isToday ? (data?.steps ?? 0) : 0;
  const goal = data?.goal ?? 0;
  const progress = goal > 0 ? steps / goal : 0;
  const updated = data
    ? isToday
      ? new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'before today'
    : '—';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: W.surface as `#${string}`,
        borderRadius: 24,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      <SvgWidget svg={ringSvg(progress)} style={{ height: 72, width: 72 }} />
      <FlexWidget style={{ flexDirection: 'column', marginLeft: 12 }}>
        <TextWidget text="Today" style={{ fontSize: 13, color: W.onSurfaceVariant as `#${string}` }} />
        <TextWidget text={formatSteps(steps)} style={{ fontSize: 26, fontWeight: '700', color: W.onSurface as `#${string}` }} />
        <TextWidget
          text={goal > 0 ? `of ${formatSteps(goal)} · ${Math.round(progress * 100)}%` : 'Open the app to start'}
          style={{ fontSize: 13, color: W.onSurfaceVariant as `#${string}` }}
        />
        <TextWidget text={`Updated ${updated}`} style={{ fontSize: 11, color: W.outline as `#${string}` }} />
      </FlexWidget>
    </FlexWidget>
  );
}
