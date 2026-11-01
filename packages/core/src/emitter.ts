type Listener<T> = (payload: T) => void;

/** A small typed event emitter. */
export class Emitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);

    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }

    set.add(listener as Listener<never>);

    return () => this.off(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>) {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  protected emit<K extends keyof Events>(event: K, payload: Events[K]) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) {
      (listener as Listener<Events[K]>)(payload);
    }
  }

  removeAllListeners() {
    this.listeners.clear();
  }
}
