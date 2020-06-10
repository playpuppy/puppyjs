export type EventCallback = (event: any) => void

export class EventSubscription {
  private events: { [key: string]: EventCallback[] } = {}

  public addEventListener(key: string, callback: EventCallback) {
    if (!this.events[key]) {
      this.events[key] = []
    }
    this.events[key].push(callback)
  }

  public dispatch(key: string, event: any) {
    if (this.events[key]) {
      for (const callback of this.events[key]) {
        setTimeout(() => callback(event), 0)
      }
    }
  }
}
