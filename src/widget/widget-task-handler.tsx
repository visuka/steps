import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { openRepository } from '@/data/db';

import { StepsWidget, type WidgetData } from './steps-widget';
import { WIDGET_DATA_KEY } from './widget-data';

/** Runs headless when the launcher asks for the widget (added, resized, periodic update). */
export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  const repo = await openRepository();
  const data = await repo.getKv<WidgetData>(WIDGET_DATA_KEY);
  renderWidget(<StepsWidget data={data} />);
}
