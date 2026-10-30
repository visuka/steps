import { requestWidgetUpdate } from 'react-native-android-widget';

import { ANDROID_WIDGET_NAME } from '@/constants/app';

import { StepsWidget, type WidgetData } from './steps-widget';

export async function pushWidgetData(data: WidgetData): Promise<void> {
  await requestWidgetUpdate({
    widgetName: ANDROID_WIDGET_NAME,
    renderWidget: () => <StepsWidget data={data} />,
    widgetNotFound: () => undefined,
  });
}
