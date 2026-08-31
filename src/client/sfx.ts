"use client";

/**
 * The interface's own voice.
 *
 * Kept entirely separate from `AudioEngine`, and not by preference. That class
 * owns one `<audio>` element for the whole session because iOS ties its
 * autoplay permission to the specific element that played during a user
 * gesture — and that element is busy holding the song, which is this game's
 * content rather than its feedback. A cue has to be able to sound *over* a clip
 * that is already playing, which one element cannot do.
 *
 * So cues go through the Web Audio API instead, and they are synthesised rather
 * than loaded. That is the same restraint the rest of this design runs on: a
 * palette of five pure tones, no samples, no reverb, nothing that sounds like a
 * brand. It also means there is nothing to preload, nothing to 404, and no
 * bytes on the wire — every cue is available the instant the context opens.
 *
 * Sound never carries anything on its own. Every cue here sits on top of a
 * visual change that already said the same thing, so a player with the volume
 * at zero loses nothing.
 */

/** A cue is one or more short tones scheduled against the cue's own start. */
export type Tone = {
  hz: number;
  /** Offset from the start of the cue. */
  startMs: number;
  ms: number;
  /** Peak amplitude before the master mix, 0..1. */
  gain: number;
};

export type Cue = "lock" | "unlock" | "correct" | "wrong" | "missed" | "finish";

/** Mirrors `RoundOutcome` in useGame. Declared here to keep sfx importing nothing. */
export type Outcome = "correct" | "wrong" | "missed";

/**
 * How far under the music the interface sits.
 *
 * Feedback that competes with the song is feedback in the wrong game. A third
 * of the music's amplitude leaves every cue audible over a clip without ever
 * being the thing you notice.
 */
export const SFX_MIX = 0.35;

/**
 * The cues, as data.
 *
 * Pitches come from one scale so the set sounds like one instrument rather than
 * six unrelated beeps. Two rules are load-bearing and are asserted in
 * `tests/sfx.test.ts` rather than left to taste:
 *
 * - Nothing that happens during a round runs long. `lock` and `unlock` play
 *   over the song and are gone before they can mask a lyric.
 * - Getting it wrong is never louder or longer than getting it right. A sound
 *   that punishes a mistake teaches players to turn the sound off.
 */
export const CUES: Record<Cue, readonly Tone[]> = {
  // Your answer is in. Over the music, so: one tone, barely there.
  lock: [{ hz: 659.25, startMs: 0, ms: 55, gain: 0.28 }],

  // A level bought. A purchase earns a second note; the clip restarts on top of
  // it, which is why it has to be over almost before it started.
  unlock: [
    { hz: 587.33, startMs: 0, ms: 60, gain: 0.3 },
    { hz: 880.0, startMs: 55, ms: 70, gain: 0.3 },
  ],

  // The reveal. The song has stopped by now, so these have room to be heard.
  correct: [
    { hz: 659.25, startMs: 0, ms: 90, gain: 0.34 },
    { hz: 880.0, startMs: 80, ms: 140, gain: 0.34 },
  ],

  // Informative, not punishing: one flat, soft tone. No descending "wah", no
  // buzzer, and quieter than `correct` on purpose.
  wrong: [{ hz: 415.3, startMs: 0, ms: 130, gain: 0.22 }],

  // You did not answer at all. The quietest thing here — running out of time is
  // already its own feedback and does not need to be underlined.
  missed: [{ hz: 349.23, startMs: 0, ms: 110, gain: 0.16 }],

  // Once a match. The one place this design spends anything.
  finish: [
    { hz: 659.25, startMs: 0, ms: 100, gain: 0.32 },
    { hz: 880.0, startMs: 90, ms: 100, gain: 0.32 },
    { hz: 1046.5, startMs: 180, ms: 220, gain: 0.32 },
  ],
};

/** Which cue a finished Round earns. */
export function outcomeCue(outcome: Outcome): Cue {
  return outcome;
}

/** How long a cue lasts end to end, in milliseconds. */
export function cueDurationMs(cue: Cue): number {
  return CUES[cue].reduce((end, t) => Math.max(end, t.startMs + t.ms), 0);
}

/** A cue's loudest moment, before the master mix. */
export function cuePeakGain(cue: Cue): number {
  return CUES[cue].reduce((peak, t) => Math.max(peak, t.gain), 0);
}

/**
 * Sound sensitivity has no media query of its own, so this borrows the one
 * that is closest in spirit: someone who has asked the interface to stop moving
 * has not asked it to start chirping. It is read at play time rather than
 * cached, so changing the system setting mid-match takes effect immediately.
 */
function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    // Blocked or unimplemented; play the cue rather than going silent.
    return false;
  }
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Linear amplitude, 0..1, matching the music's own volume setting. */
  private volume = 1;

  /**
   * Open the audio context. Must be called from inside a real user gesture,
   * once per session — the same tap that unlocks the music.
   */
  unlock(): boolean {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return false;
      if (!this.ctx) {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume * SFX_MIX;
        this.master.connect(this.ctx.destination);
      }
      void this.ctx.resume();
      return true;
    } catch {
      // No Web Audio, or the context was refused. The game is fully playable
      // in silence, so this is not worth surfacing.
      return false;
    }
  }

  /**
   * Follow the music's volume control.
   *
   * There is deliberately no second slider for cues. Everything here is already
   * mixed a third under the song, and the game has one volume control because
   * the header has room for one — see `Shell`.
   */
  setVolume(value: number): void {
    this.volume = Math.min(Math.max(value, 0), 1);
    if (this.master) this.master.gain.value = this.volume * SFX_MIX;
  }

  play(cue: Cue): void {
    if (this.volume === 0) return;
    if (prefersReducedMotion()) return;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    // A context can be suspended by the browser between rounds; nudging it here
    // is free when it is already running.
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    for (const tone of CUES[cue]) {
      const start = now + tone.startMs / 1000;
      const end = start + tone.ms / 1000;

      const osc = ctx.createOscillator();
      // A triangle keeps some edge over a playing clip where a sine disappears,
      // without the buzz a square would bring to a design this quiet.
      osc.type = "triangle";
      osc.frequency.value = tone.hz;

      // Struck and allowed to ring, rather than switched on and off: a gate
      // with no envelope clicks at both ends.
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(tone.gain, start + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(env);
      env.connect(master);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }

  dispose(): void {
    void this.ctx?.close().catch(() => {
      // Already closed, or closing twice on a fast unmount. Nothing to do.
    });
    this.ctx = null;
    this.master = null;
  }
}
