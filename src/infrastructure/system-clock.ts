import { fromJsDate, type Clock, type PlainDate } from '../domain';

/** Clock adapter backed by the browser's local time. */
export class SystemClock implements Clock {
  today(): PlainDate {
    return fromJsDate(new Date());
  }
}
