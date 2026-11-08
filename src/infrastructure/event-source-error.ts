/** Raised for any failure loading events, with a user-presentable message. */
export class EventSourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EventSourceError';
  }
}
