"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { MatchConfig, RoomListing, RoomState } from "@/shared/types";
import type {
  Ack,
  AnswerResult,
  ClientToServerEvents,
  JoinResult,
  ReactionId,
  ServerToClientEvents,
} from "@/shared/protocol";
import { MODES, unlockedMs } from "@/shared/modes";
import { AudioEngine } from "./audio";
import { SoundEngine, outcomeCue } from "./sfx";
import { isCountIn } from "./roundStatus";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SESSION_KEY = "guess-music.session";
const VOLUME_KEY = "guess-music.volume";

/** How many blocks the volume control shows, and its maximum step. */
export const VOLUME_STEPS = 5;

/** Loud enough to hear, quiet enough not to startle a room full of phones. */
const DEFAULT_VOLUME_STEP = 4;

/**
 * Steps are spaced by amplitude squared.
 *
 * `HTMLMediaElement.volume` is a linear amplitude, but loudness is not heard
 * linearly: evenly spaced amplitudes bunch up at the top, so the first press of
 * minus would barely register while the last would cut the sound out. Squaring
 * spreads the steps out the way an ear expects.
 */
/**
 * Interpret whatever is in storage as a volume step.
 *
 * `null` means the visitor has never chosen, which is not the same as choosing
 * silence — and `Number(null)` is 0, so conflating the two hands every
 * first-time player a muted game.
 */
export function readVolumeStep(raw: string | null): number {
  // Both `null` and `""` convert to 0, and both mean "nothing was stored".
  if (raw === null || raw.trim() === "") return DEFAULT_VOLUME_STEP;
  const saved = Number(raw);
  if (!Number.isInteger(saved) || saved < 0 || saved > VOLUME_STEPS) {
    return DEFAULT_VOLUME_STEP;
  }
  return saved;
}

export function stepToVolume(step: number): number {
  const clamped = Math.min(Math.max(step, 0), VOLUME_STEPS);
  return (clamped / VOLUME_STEPS) ** 2;
}

/** How many round trips to sample when measuring clock skew. */
const CLOCK_SAMPLES = 5;

type StoredSession = { code: string; sessionId: string; name: string };

export type ConnectionStatus = "connecting" | "online" | "offline";

/** How one Round went for this player. Undefined means it has not happened. */
export type RoundOutcome = "correct" | "wrong" | "missed";

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    // Private mode and blocked site data both land here; reconnect simply
    // becomes a fresh join.
    return null;
  }
}

function writeSession(session: StoredSession | null): void {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* see readSession */
  }
}

export function useGame() {
  const socketRef = useRef<GameSocket | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const sfxRef = useRef<SoundEngine | null>(null);
  /** Server time minus client time, in ms. */
  const clockOffsetRef = useRef(0);
  const playerIdRef = useRef<string | null>(null);
  /** Round index we have already reported ready for. */
  const readyForRef = useRef(-1);
  /** Round and unlock level we have already played, as "index:level". */
  const playedRef = useRef("");
  /** Round we have already sounded a result for. */
  const revealedRef = useRef(-1);
  /** The unlock level we last saw, and the Round it belonged to. */
  const levelRef = useRef({ index: -1, level: 0 });
  /** Whether the room's mode types its answers. Read inside `answer`. */
  const typedModeRef = useRef(false);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [volumeStep, setVolumeStepState] = useState(DEFAULT_VOLUME_STEP);
  const [history, setHistory] = useState<RoundOutcome[]>([]);
  /** Track id currently being replayed on the recap screen, if any. */
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [roomList, setRoomList] = useState<RoomListing[]>([]);
  /**
   * The wrong titles this player has already tried, and the Round they belong
   * to. Kept with the index so a guess from the round that just ended cannot
   * appear under the next one.
   */
  const [guessLog, setGuessLog] = useState<{ index: number; wrong: string[] }>({
    index: -1,
    wrong: [],
  });
  const [reactions, setReactions] = useState<Record<string, { reaction: ReactionId; id: string }>>({});

  if (!audioRef.current && typeof window !== "undefined") {
    audioRef.current = new AudioEngine();
    sfxRef.current = new SoundEngine();
  }

  // Read the saved level after mount, not during render: the server has no
  // idea what this visitor picked last time.
  useEffect(() => {
    let step = DEFAULT_VOLUME_STEP;
    try {
      step = readVolumeStep(localStorage.getItem(VOLUME_KEY));
    } catch {
      // Blocked site data; the default is fine.
    }
    setVolumeStepState(step);
    audioRef.current?.setVolume(stepToVolume(step));
    sfxRef.current?.setVolume(stepToVolume(step));
  }, []);

  const setVolumeStep = useCallback((next: number) => {
    const step = Math.min(Math.max(Math.round(next), 0), VOLUME_STEPS);
    setVolumeStepState(step);
    audioRef.current?.setVolume(stepToVolume(step));
    sfxRef.current?.setVolume(stepToVolume(step));
    try {
      localStorage.setItem(VOLUME_KEY, String(step));
    } catch {
      // See above.
    }
  }, []);

  // ------------------------------------------------------------------ socket

  useEffect(() => {
    const socket: GameSocket = io({
      // Start on polling and upgrade: if the Nginx WebSocket headers are ever
      // wrong the game still works, just chattier, instead of hanging on a
      // blank "connecting" screen.
      transports: ["polling", "websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("online");
      void syncClock(socket, clockOffsetRef);

      // Reclaim our seat after a refresh or a dropped connection.
      const saved = readSession();
      if (saved) {
        socket.emit(
          "room:join",
          { code: saved.code, name: saved.name, sessionId: saved.sessionId },
          (res: Ack<JoinResult>) => {
            if (res.ok) {
              playerIdRef.current = res.data.playerId;
              setPlayerId(res.data.playerId);
              writeSession({ ...saved, sessionId: res.data.sessionId });
            } else {
              writeSession(null);
            }
          },
        );
      }
    });

    socket.on("disconnect", () => setStatus("offline"));
    socket.on("room:state", (next) => setRoom(next));
    socket.on("rooms:listing", (rooms) => setRoomList(rooms));
    socket.on("room:error", (e) => setError(e.message));
    socket.on("room:reaction", ({ playerId, reaction, id }) => {
      setReactions((prev) => ({ ...prev, [playerId]: { reaction, id } }));
      setTimeout(() => {
        setReactions((prev) => (prev[playerId]?.id === id ? { ...prev, [playerId]: undefined as any } : prev));
      }, 2200);
    });
    socket.on("room:closed", () => {
      writeSession(null);
      setRoom(null);
    });
    socket.on("room:kicked", ({ message }) => {
      writeSession(null);
      setRoom(null);
      setPlayerId(null);
      audioRef.current?.stop();
      setError(message);
    });

    return () => {
      socket.close();
      socketRef.current = null;
      audioRef.current?.dispose();
      sfxRef.current?.dispose();
    };
  }, []);

  /**
   * Watch the public room list only while sitting on the home screen. A room in
   * progress has no use for it, and a table of every room in the building is
   * not something to keep pushing at eight phones mid-round.
   */
  const browsing = room === null && status === "online";
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (!browsing) {
      socket.emit("rooms:unwatch");
      return;
    }
    socket.emit("rooms:watch");
    return () => {
      socket.emit("rooms:unwatch");
    };
  }, [browsing]);

  // ------------------------------------------------------------------- audio
  //
  // The server drives audio through the room phase, so this effect is the only
  // place playback is decided. Components never touch the AudioEngine.

  const phase = room?.phase;
  const round = room?.round ?? null;

  // `answer` is a stable callback with no dependencies, so the one fact it
  // needs about the room is mirrored into a ref rather than rebuilding it.
  useEffect(() => {
    typedModeRef.current = room ? MODES[room.config.mode].typed : false;
  }, [room]);

  /**
   * How far the clip is unlocked for us, and therefore how much of it plays.
   * Zero-length stages mean Quiz, where the clip never changes.
   */
  const myLevel = useMemo(() => {
    if (!round || !playerId) return 0;
    return round.levels.find((l) => l.playerId === playerId)?.level ?? 0;
  }, [round, playerId]);

  const audibleMs = round
    ? round.stagesMs.length > 0
      ? unlockedMs(round.stagesMs, myLevel)
      : round.clipMs
    : 0;
  const revealNext = room?.reveal?.nextPreviewUrl ?? null;
  const reveal = room?.reveal ?? null;

  // Record how each Round went as its reveal lands. The server sends only the
  // current Round's results, so a running history has to be kept here.
  useEffect(() => {
    if (!reveal || !playerId) return;
    // Guarded by a ref rather than by the history itself: the cue is a side
    // effect, and a `setHistory` updater has to stay pure enough to be called
    // twice.
    if (revealedRef.current === reveal.index) return;
    revealedRef.current = reveal.index;

    const mine = reveal.results.find((r) => r.playerId === playerId);
    const outcome: RoundOutcome = mine?.correct
      ? "correct"
      : mine?.choiceId
        ? "wrong"
        : "missed";
    sfxRef.current?.play(outcomeCue(outcome));

    setHistory((prev) => {
      if (prev[reveal.index] !== undefined) return prev;
      const next = prev.slice();
      next[reveal.index] = outcome;
      return next;
    });
  }, [reveal, playerId]);

  /**
   * A level bought.
   *
   * Fired off the level the server sent back rather than off the tap, so it
   * lands with the step that grows on screen and never sounds for a purchase
   * that did not go through. In the co-op mode the whole room hears it, which
   * is right — the whole room paid for it.
   */
  useEffect(() => {
    if (!round) return;
    const previous = levelRef.current;
    levelRef.current = { index: round.index, level: myLevel };
    if (previous.index === round.index && myLevel > previous.level) {
      sfxRef.current?.play("unlock");
    }
  }, [round, myLevel]);

  // Once a match, and only on the way in: `phase` is a string, so this runs
  // when the match ends rather than on every broadcast that follows.
  useEffect(() => {
    if (phase === "finished") sfxRef.current?.play("finish");
  }, [phase]);

  /**
   * Whether the Match is being counted in right now.
   *
   * Lives here rather than in a component because it decides which screen the
   * page shows, and because the moment it ends is a server time this hook
   * already knows how to read.
   */
  const [countingIn, setCountingIn] = useState(false);
  useEffect(() => {
    if (phase !== "playing" || !round) {
      setCountingIn(false);
      return;
    }
    const now = Date.now() + clockOffsetRef.current;
    if (!isCountIn(round.index, round.startAt, now)) {
      setCountingIn(false);
      return;
    }
    setCountingIn(true);
    const done = setTimeout(() => setCountingIn(false), round.startAt - now);
    return () => clearTimeout(done);
  }, [phase, round]);

  useEffect(() => {
    const audio = audioRef.current;
    const socket = socketRef.current;
    if (!audio || !socket || !round) return;

    if (phase === "loading") {
      if (readyForRef.current === round.index) return;
      let cancelled = false;
      void audio.load(round.previewUrl).then(() => {
        if (cancelled) return;
        readyForRef.current = round.index;
        socket.emit("round:ready", { index: round.index });
      });
      return () => {
        cancelled = true;
      };
    }

    // Heardle replays from the beginning every time a level is spent — hearing
    // the song grow from the top is the mode, not a longer tail.
    const key = `${round.index}:${myLevel}`;
    if (phase === "playing" && playedRef.current !== key) {
      playedRef.current = key;
      // The Round goes live a beat before the clip does, so nobody has to
      // catch the first second by luck. `startAt` is that moment, corrected
      // for this client's clock skew — a level bought mid-round is already
      // past it and plays at once.
      const wait = Math.max(round.startAt - (Date.now() + clockOffsetRef.current), 0);
      if (wait === 0) {
        audio.play(round.previewUrl, audibleMs);
      } else {
        const lead = setTimeout(
          () => audio.play(round.previewUrl, audibleMs),
          wait,
        );
        return () => clearTimeout(lead);
      }
    }
  }, [phase, round, myLevel, audibleMs]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (phase === "reveal" || phase === "finished" || phase === "lobby") {
      audio.stop();
    }
    // Buffer the next Round while the reveal is on screen, so the next
    // `loading` phase resolves instantly.
    if (phase === "reveal" && revealNext) void audio.load(revealNext);
  }, [phase, revealNext]);

  // ----------------------------------------------------------------- actions

  const unlockAudio = useCallback(async () => {
    // Opened first, and synchronously. This is the same gesture that unlocks
    // the music, but it has to happen before the `await` below: Safari stops
    // treating a call as user-initiated once the handler has yielded, so
    // opening the context after the element would silently fail there.
    sfxRef.current?.unlock();
    const ok = (await audioRef.current?.unlock()) ?? false;
    setAudioUnlocked(ok);
    return ok;
  }, []);

  const createRoom = useCallback(async (name: string) => {
    const socket = socketRef.current;
    if (!socket) return false;
    setError(null);
    return new Promise<boolean>((resolve) => {
      socket.emit("room:create", { name }, (res: Ack<JoinResult>) => {
        if (!res.ok) {
          setError(res.error);
          return resolve(false);
        }
        playerIdRef.current = res.data.playerId;
        setPlayerId(res.data.playerId);
        writeSession({ code: res.data.code, sessionId: res.data.sessionId, name });
        resolve(true);
      });
    });
  }, []);

  const joinRoom = useCallback(async (code: string, name: string) => {
    const socket = socketRef.current;
    if (!socket) return false;
    setError(null);
    return new Promise<boolean>((resolve) => {
      socket.emit("room:join", { code, name }, (res: Ack<JoinResult>) => {
        if (!res.ok) {
          setError(res.error);
          return resolve(false);
        }
        playerIdRef.current = res.data.playerId;
        setPlayerId(res.data.playerId);
        writeSession({ code: res.data.code, sessionId: res.data.sessionId, name });
        resolve(true);
      });
    });
  }, []);

  /** Host only: hide the room from the browser, or put it back. */
  const setLocked = useCallback((locked: boolean) => {
    socketRef.current?.emit("room:lock", { locked });
  }, []);

  const setConfig = useCallback((config: MatchConfig) => {
    socketRef.current?.emit("room:config", config);
  }, []);

  const startMatch = useCallback(() => {
    setError(null);
    setHistory([]);
    setPreviewingId(null);
    setGuessLog({ index: -1, wrong: [] });
    readyForRef.current = -1;
    playedRef.current = "";
    revealedRef.current = -1;
    levelRef.current = { index: -1, level: 0 };
    socketRef.current?.emit("match:start");
  }, []);

  /** Replay one song from the end-of-match recap, or stop the one playing. */
  const togglePreview = useCallback(
    (trackId: string, url: string) => {
      const audio = audioRef.current;
      if (!audio) return;
      // Tapping the one already playing stops it; the pause it causes clears
      // the flag through the same callback.
      if (previewingId === trackId) {
        audio.stop();
        setPreviewingId(null);
        return;
      }
      setPreviewingId(trackId);
      audio.playPreview(url, () =>
        setPreviewingId((current) => (current === trackId ? null : current)),
      );
    },
    [previewingId],
  );

  /** Host only: back to the lobby with the room and its players intact. */
  const returnToLobby = useCallback(() => {
    setError(null);
    audioRef.current?.stop();
    setPreviewingId(null);
    socketRef.current?.emit("match:lobby");
  }, []);

  /**
   * Send a guess: a choice id in Quiz, a typed title in Heardle.
   *
   * The verdict comes back on the ack rather than in the room snapshot,
   * because a wrong Heardle guess is private to whoever made it.
   */
  const answer = useCallback(
    (index: number, guess: string) =>
      new Promise<AnswerResult | null>((resolve) => {
        const socket = socketRef.current;
        if (!socket) return resolve(null);
        // This cue belongs to the tap, not to the round trip: the tile locks in
        // on screen the moment it is pressed, and the sound has to land with it.
        sfxRef.current?.play("lock");
        socket.emit("round:answer", { index, guess }, (res: Ack<AnswerResult>) => {
          if (!res.ok) return resolve(null);
          if (!res.data.correct) {
            // A rejected typed guess is private and is already on screen struck
            // through, so saying it out loud gives nothing away. The identical
            // verdict in Quiz is a secret until the reveal and stays one.
            if (typedModeRef.current) sfxRef.current?.play("wrong");
            setGuessLog((prev) =>
              prev.index === index
                ? { index, wrong: prev.wrong.includes(guess) ? prev.wrong : [...prev.wrong, guess] }
                : { index, wrong: [guess] },
            );
          }
          resolve(res.data);
        });
      }),
    [],
  );

  /** Heardle: spend a level to hear more. */
  const unlock = useCallback((index: number) => {
    socketRef.current?.emit("round:unlock", { index });
  }, []);

  /**
   * Play the unlocked stretch again, free.
   *
   * A player who missed one second of a song they know would otherwise have to
   * buy the next level to get another listen, which charges them for a lapse in
   * attention rather than in knowledge.
   */
  const replayClip = useCallback(() => {
    if (!round || audibleMs <= 0) return;
    audioRef.current?.play(round.previewUrl, audibleMs);
  }, [round, audibleMs]);

  const leave = useCallback(() => {
    writeSession(null);
    setRoom(null);
    setPlayerId(null);
    audioRef.current?.stop();
    // Reconnecting is the cheapest way to drop every server-side binding.
    socketRef.current?.disconnect().connect();
  }, []);

  /** Current server time, corrected for this client's clock skew. */
  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, []);

  const me = useMemo(
    () => room?.players.find((p) => p.id === playerId) ?? null,
    [room, playerId],
  );

  /** Wrong titles already tried on the Round on screen, and only that Round. */
  const wrongGuesses = useMemo(
    () => (round && guessLog.index === round.index ? guessLog.wrong : []),
    [round, guessLog],
  );

  const react = useCallback((reaction: ReactionId) => {
    socketRef.current?.emit("room:react", { reaction });
  }, []);

  /** Host only: remove a player and block their session from rejoining. */
  const kick = useCallback((targetPlayerId: string) => {
    socketRef.current?.emit("room:kick", { playerId: targetPlayerId });
  }, []);

  /** Host only: stop or resume a player's reaction stamps reaching the room. */
  const setMuted = useCallback((targetPlayerId: string, muted: boolean) => {
    socketRef.current?.emit("room:mute", { playerId: targetPlayerId, muted });
  }, []);

  return {
    status,
    room,
    me,
    playerId,
    error,
    clearError: () => setError(null),
    audioUnlocked,
    unlockAudio,
    volumeStep,
    setVolumeStep,
    history,
    countingIn,
    wrongGuesses,
    myLevel,
    audibleMs,
    unlock,
    replayClip,
    previewingId,
    togglePreview,
    createRoom,
    joinRoom,
    setConfig,
    setLocked,
    roomList,
    startMatch,
    returnToLobby,
    answer,
    leave,
    serverNow,
    reactions,
    react,
    kick,
    setMuted,
  };
}

/**
 * Measure how far this client's clock sits from the server's.
 *
 * Several samples, keep the one with the shortest round trip: that sample spent
 * the least time in transit, so its midpoint estimate is the least wrong. This
 * is what lets the countdown run locally at 60fps against a server deadline.
 */
async function syncClock(
  socket: GameSocket,
  offsetRef: { current: number },
): Promise<void> {
  let bestRtt = Infinity;
  for (let i = 0; i < CLOCK_SAMPLES; i++) {
    const sentAt = Date.now();
    const serverNow = await new Promise<number>((resolve) => {
      socket.emit("clock:sync", resolve);
    });
    const rtt = Date.now() - sentAt;
    if (rtt < bestRtt) {
      bestRtt = rtt;
      offsetRef.current = serverNow + rtt / 2 - Date.now();
    }
  }
}
