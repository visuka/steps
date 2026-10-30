'use no memo';
// Android home-screen widget. Rendered to native RemoteViews by
// react-native-android-widget, so only its widget primitives work here.
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { formatSteps } from '@/lib/format';

export interface WidgetData {
  steps: number;
  goal: number;
  updatedAt: number;
}

function ringSvg(progress: number) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const filled = Math.min(1, progress) * c;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="#2A2F35" stroke-width="10"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="#34D399" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${filled} ${c}" transform="rotate(-90 50 50)"/>
  </svg>`;
}

export function StepsWidget({ data }: { data: WidgetData | null }) {
  const steps = data?.steps ?? 0;
  const goal = data?.goal ?? 0;
  const progress = goal > 0 ? steps / goal : 0;
  const updated = data
    ? new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#15181C',
        borderRadius: 24,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      <SvgWidget svg={ringSvg(progress)} style={{ height: 72, width: 72 }} />
      <FlexWidget style={{ flexDirection: 'column', marginLeft: 12 }}>
        <TextWidget text="Today" style={{ fontSize: 13, color: '#9BA1A6' }} />
        <TextWidget text={formatSteps(steps)} style={{ fontSize: 26, fontWeight: '700', color: '#FFFFFF' }} />
        <TextWidget
          text={goal > 0 ? `of ${formatSteps(goal)} · ${Math.round(progress * 100)}%` : 'Open the app to start'}
          style={{ fontSize: 13, color: '#9BA1A6' }}
        />
        <TextWidget text={`Updated ${updated}`} style={{ fontSize: 11, color: '#6B7178' }} />
      </FlexWidget>
    </FlexWidget>
  );
}
