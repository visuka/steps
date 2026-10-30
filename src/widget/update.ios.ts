import { ExtensionStorage } from '@bacons/apple-targets';

import { APP_GROUP, IOS_WIDGET_KIND } from '@/constants/app';

import type { WidgetData } from './steps-widget';

const storage = new ExtensionStorage(APP_GROUP);

/** Writes to the shared App Group defaults the Swift widget reads, then asks WidgetKit to redraw. */
export async function pushWidgetData(data: WidgetData): Promise<void> {
  storage.set('steps', data.steps);
  storage.set('goal', data.goal);
  storage.set('updatedAt', data.updatedAt / 1000);
  ExtensionStorage.reloadWidget(IOS_WIDGET_KIND);
}
