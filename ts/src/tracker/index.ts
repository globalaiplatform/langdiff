export * from './change-tracker';
export * from './changes';
export * from './impl';

import { ChangeTracker, DiffBuffer } from './change-tracker';
import { EfficientJSONPatchChangeTracker } from './impl';

/**
 * Track changes to an object and return a tracked proxy and diff buffer.
 */
export function trackChange<T>(
  obj: T,
  trackerClass: new () => ChangeTracker = EfficientJSONPatchChangeTracker
): [T, DiffBuffer] {
  const tracker = new trackerClass();
  const trackedObj = tracker.track(obj);
  return [trackedObj, tracker];
}
