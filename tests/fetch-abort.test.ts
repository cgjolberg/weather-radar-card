import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Regression guards for the AbortController pattern the fetcher code
// relies on. The actual layer integration (FetchTileLayer, WildfireLayer,
// NwsAlertsLayer, RadarPlayer) isn't exercised here — those need full
// Leaflet/DOM mocking that the existing test suite avoids on principle.
// Instead these tests lock in the contract our error-handler branches
// depend on, so a future "simplification" that drops the
// `.name === 'AbortError'` check or assumes a different exception type
// breaks loud rather than silently.

describe('AbortController + AbortSignal contract (regression guard)', () => {
  it('AbortError thrown by signal.throwIfAborted has name "AbortError"', () => {
    // Our layer error handlers all branch on `(err as Error)?.name ===
    // 'AbortError'` to distinguish user-initiated cancellation from
    // network failure. If the runtime ever switched to a different name
    // (DOMException codes, custom errors, etc.) every layer's error
    // path would silently mis-classify the cancellation as a real error.
    const ctrl = new AbortController();
    ctrl.abort();
    try {
      ctrl.signal.throwIfAborted();
      throw new Error('throwIfAborted should have thrown');
    } catch (err) {
      expect((err as Error).name).toBe('AbortError');
    }
  });

  it('aborting after settlement is a no-op (does not throw)', () => {
    // After a fetch resolves, we null out the stored controller. If the
    // layer is torn down later, ctrl?.abort() may target a controller
    // whose fetch already settled. The spec guarantees that's safe;
    // pin against any runtime change to that.
    const ctrl = new AbortController();
    expect(() => ctrl.abort()).not.toThrow();
    expect(() => ctrl.abort()).not.toThrow();
  });

  it('aborted signal reports aborted=true and reason="AbortError"', () => {
    const ctrl = new AbortController();
    expect(ctrl.signal.aborted).toBe(false);
    ctrl.abort();
    expect(ctrl.signal.aborted).toBe(true);
    expect((ctrl.signal.reason as Error)?.name).toBe('AbortError');
  });
});

// Replicate the pattern used in wildfire-layer / nws-alerts-layer /
// radar-player so we can test it without Leaflet. If this helper's
// behaviour drifts from the real code, we should refactor to share —
// for now the simplicity wins. Both layers call:
//   this._ctrl?.abort();
//   const ctrl = new AbortController();
//   this._ctrl = ctrl;
//   try { ... } catch (err) { if (err.name === 'AbortError') return; }
//   finally { if (this._ctrl === ctrl) this._ctrl = null; }
class Fetcher {
  private _ctrl: AbortController | null = null;
  abortedCount = 0;
  succeededCount = 0;
  erroredCount = 0;

  async fetchUrl(url: string): Promise<string | null> {
    this._ctrl?.abort();
    const ctrl = new AbortController();
    this._ctrl = ctrl;
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      const text = await res.text();
      this.succeededCount++;
      return text;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        this.abortedCount++;
        return null;
      }
      this.erroredCount++;
      throw err;
    } finally {
      if (this._ctrl === ctrl) this._ctrl = null;
    }
  }

  teardown(): void {
    this._ctrl?.abort();
    this._ctrl = null;
  }
}

describe('Fetcher pattern: abort-previous on supersession + abort on teardown', () => {
  // Mock fetch with controllable promises so the tests don't depend on
  // network or happy-dom's quirky AbortError handling.
  let fetchCalls: Array<{ url: string; signal: AbortSignal; resolve: (text: string) => void; reject: (err: Error) => void }>;
  const realFetch = global.fetch;

  beforeEach(() => {
    fetchCalls = [];
    global.fetch = vi.fn((url: string | URL, init?: RequestInit) => {
      let resolve!: (text: string) => void;
      let reject!: (err: Error) => void;
      const responsePromise = new Promise<Response>((res, rej) => {
        resolve = (text: string) => res(new Response(text));
        reject = (err: Error) => rej(err);
      });
      const signal = init?.signal as AbortSignal;
      // Wire abort → reject(AbortError) so the mock matches browser
      // fetch's behaviour. happy-dom's fetch doesn't do this reliably.
      if (signal) {
        const onAbort = (): void => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        };
        if (signal.aborted) {
          onAbort();
        } else {
          signal.addEventListener('abort', onAbort, { once: true });
        }
      }
      fetchCalls.push({ url: String(url), signal, resolve, reject });
      return responsePromise;
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('a fresh fetch aborts the in-flight previous one and is counted as AbortError', async () => {
    const f = new Fetcher();
    const first = f.fetchUrl('https://a.test/1');
    // Second call should abort the first before issuing its own request.
    const second = f.fetchUrl('https://a.test/2');
    // Resolve the second so the test doesn't hang on its unresolved promise.
    expect(fetchCalls.length).toBe(2);
    fetchCalls[1].resolve('second-body');
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toBeNull();      // first caught AbortError → returned null
    expect(secondResult).toBe('second-body');
    expect(f.abortedCount).toBe(1);
    expect(f.succeededCount).toBe(1);
    expect(f.erroredCount).toBe(0);
    // The first call's signal should report aborted; the second's should not.
    expect(fetchCalls[0].signal.aborted).toBe(true);
    expect(fetchCalls[1].signal.aborted).toBe(false);
  });

  it('teardown aborts the in-flight fetch', async () => {
    const f = new Fetcher();
    const inflight = f.fetchUrl('https://a.test/3');
    expect(fetchCalls.length).toBe(1);
    f.teardown();
    const result = await inflight;
    expect(result).toBeNull();
    expect(f.abortedCount).toBe(1);
    expect(fetchCalls[0].signal.aborted).toBe(true);
  });

  it('non-AbortError exceptions propagate (do not get swallowed as cancellations)', async () => {
    const f = new Fetcher();
    const p = f.fetchUrl('https://a.test/4');
    fetchCalls[0].reject(new Error('network blew up'));
    await expect(p).rejects.toThrow('network blew up');
    expect(f.erroredCount).toBe(1);
    expect(f.abortedCount).toBe(0);
  });

  it('a successful fetch clears the stored controller so teardown does not double-abort', async () => {
    const f = new Fetcher();
    const p = f.fetchUrl('https://a.test/5');
    fetchCalls[0].resolve('ok');
    expect(await p).toBe('ok');
    // After success, teardown should be a no-op for an already-settled fetch.
    expect(() => f.teardown()).not.toThrow();
    expect(f.abortedCount).toBe(0);
  });
});
