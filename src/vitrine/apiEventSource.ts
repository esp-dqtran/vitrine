import { apiFetch } from './apiFetch.ts';

export interface ApiEventSource {
  addEventListener(type: string, listener: EventListener): void;
  close(): void;
}

class BearerEventSource implements ApiEventSource {
  readonly #listeners = new Map<string, Set<EventListener>>();
  readonly #controller = new AbortController();
  readonly #url: string;
  #closed = false;

  constructor(url: string) {
    this.#url = url;
    void this.#connect();
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.#listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  close(): void {
    this.#closed = true;
    this.#controller.abort();
  }

  #dispatch(type: string, event: Event): void {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }

  async #connect(): Promise<void> {
    try {
      const response = await apiFetch(this.#url, {
        headers: { accept: 'text/event-stream' },
        signal: this.#controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`Event stream returned ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventType = 'message';
      let data: string[] = [];
      const processLine = (line: string) => {
        if (!line) {
          if (data.length) {
            this.#dispatch(eventType, new MessageEvent(eventType, { data: data.join('\n') }));
          }
          eventType = 'message';
          data = [];
          return;
        }
        if (line.startsWith(':')) return;
        const separator = line.indexOf(':');
        const field = separator < 0 ? line : line.slice(0, separator);
        const rawValue = separator < 0 ? '' : line.slice(separator + 1);
        const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
        if (field === 'event') eventType = value || 'message';
        else if (field === 'data') data.push(value);
      };

      while (!this.#closed) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, '');
          buffer = buffer.slice(newline + 1);
          processLine(line);
          newline = buffer.indexOf('\n');
        }
        if (done) break;
      }
      if (buffer) processLine(buffer.replace(/\r$/, ''));
    } catch (error) {
      if (!this.#closed && !(error instanceof DOMException && error.name === 'AbortError')) {
        this.#dispatch('error', new Event('error'));
      }
    }
  }
}

export function createApiEventSource(url: string): ApiEventSource {
  return new BearerEventSource(url);
}
