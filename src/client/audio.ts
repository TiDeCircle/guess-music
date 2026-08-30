"use client";

/**
 * Audio playback for the game.
 *
 * One <audio> element for the whole session, reused for every Round. That is
 * not a micro-optimisation: iOS ties its autoplay permission to the specific
 * element that played during a user gesture, so a fresh element per round would
 * be silent on iPhone no matter how many times the player tapped.
 */

/** 100ms of silence, enough to satisfy a gesture-triggered play(). */
const SILENCE =
  "data:audio/mp4;base64,AAAAHGZ0eXBNNEEgAAACAGlzb21pc28yTTRBIAAAAAhmcmVlAAAAG21kYXQAAAGzABAHAAABthADAowdbb9/AAAC7W1vb3YAAABsbXZoZAAAAAB8JbCAfCWwgAAAA+gAAAAeAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI=";

/**
 * How long past the clip length the wall-clock backstop waits, giving a
 * stalling connection room to deliver the rest of the audio. Stays under the
 * five seconds of Silence every difficulty allows, so the sound is always gone
 * before the reveal.
 */
const STALL_ALLOWANCE_MS = 3_000;

export type AudioState = "idle" | "loading" | "ready" | "playing" | "error";

export class AudioEngine {
  private el: HTMLAudioElement | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private loadedUrl: string | null = null;
  private unlocked = false;
  /** Removes the timeupdate listener that enforces the clip length. */
  private clipWatcher: (() => void) | null = null;
  /** Linear amplitude, 0..1. Kept here so it survives element creation. */
  private volume = 1;

  /**
   * Set playback volume as a linear amplitude.
   *
   * The element keeps this across src changes, but we hold it too: the element
   * is created lazily, and a volume set before the first round would otherwise
   * be lost.
   */
  setVolume(value: number): void {
    this.volume = Math.min(Math.max(value, 0), 1);
    if (this.el) this.el.volume = this.volume;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  /**
   * Must be called from inside a real user gesture (a click handler), once per
   * session. Everything after this can start playback on its own.
   */
  async unlock(): Promise<boolean> {
    const el = this.element();
    try {
      el.src = SILENCE;
      el.muted = true;
      await el.play();
      el.pause();
      el.muted = false;
      el.volume = this.volume;
      el.currentTime = 0;
      this.unlocked = true;
      this.loadedUrl = null;
      return true;
    } catch {
      el.muted = false;
      return false;
    }
  }

  /**
   * Buffer a Preview. Resolves when the browser says it can play through
   * without stalling — which is what the server waits for before starting the
   * Round clock.
   */
  load(url: string): Promise<void> {
    const el = this.element();
    if (this.loadedUrl === url && el.readyState >= 3) return Promise.resolve();

    this.cancelStop();
    this.loadedUrl = url;
    el.pause();
    // Apple serves previews with permissive CORS, so this stays anonymous
    // rather than sending credentials that would be rejected.
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.src = url;
    el.load();

    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const cleanup = () => {
        el.removeEventListener("canplaythrough", done);
        el.removeEventListener("error", done);
        clearTimeout(guard);
      };
      // Resolve on error too: the server has its own timeout, and a silent
      // round is better than a room stuck waiting on one broken URL.
      el.addEventListener("canplaythrough", done, { once: true });
      el.addEventListener("error", done, { once: true });
      const guard = setTimeout(done, 6_000);
    });
  }

  /**
   * Play from the start and cut the sound after clipMs of audio.
   *
   * The cut is driven by the track's own position rather than a wall clock: a
   * stall on a phone connection would otherwise eat into the clip, and a player
   * on bad wifi would hear ten seconds of a difficulty that promised fifteen.
   * The wall clock stays on as a backstop for the case where playback never
   * really starts and `timeupdate` therefore never fires.
   */
  play(url: string, clipMs: number): void {
    const el = this.element();
    this.cancelStop();

    if (this.loadedUrl !== url) {
      this.loadedUrl = url;
      el.src = url;
    }
    try {
      el.currentTime = 0;
    } catch {
      // Safari throws if metadata isn't in yet; playback still starts at 0.
    }
    void el.play().catch(() => {
      // Blocked or interrupted. The round continues in silence rather than
      // throwing the whole client into an error state.
    });

    const clipSeconds = clipMs / 1000;
    const onTimeUpdate = () => {
      if (el.currentTime >= clipSeconds) this.stop();
    };
    // Fires roughly four times a second, so the cut lands within ~250ms of the
    // mark — inaudible next to a clip measured in seconds.
    el.addEventListener("timeupdate", onTimeUpdate);
    this.clipWatcher = () => el.removeEventListener("timeupdate", onTimeUpdate);

    // Capped below the Answer Window (always clip + 5s) so a stalled clip can
    // catch up without ever still playing when the round is revealed.
    this.stopTimer = setTimeout(() => this.stop(), clipMs + STALL_ALLOWANCE_MS);
  }

  stop(): void {
    this.cancelStop();
    const el = this.el;
    if (!el) return;
    el.pause();
    try {
      el.currentTime = 0;
    } catch {
      /* see play() */
    }
  }

  dispose(): void {
    this.cancelStop();
    this.el?.pause();
    this.el = null;
    this.loadedUrl = null;
  }

  private cancelStop(): void {
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = null;
    this.clipWatcher?.();
    this.clipWatcher = null;
  }

  private element(): HTMLAudioElement {
    if (!this.el) {
      this.el = new Audio();
      this.el.preload = "auto";
      this.el.volume = this.volume;
    }
    return this.el;
  }
}
