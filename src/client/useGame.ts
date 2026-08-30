"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { MatchConfig, RoomState } from "@/shared/types";
import type {
  Ack,
  ClientToServerEvents,
  JoinResult,
  ServerToClientEvents,
} from "@/shared/protocol";
import { AudioEngine } from "./audio";

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
  /** Server time minus client time, in ms. */
  const clockOffsetRef = useRef(0);
  const playerIdRef = useRef<string | null>(null);
  /** Round index we have already reported ready for. */
  const readyForRef = useRef(-1);
  /** Round index we have already started playing. */
  const playedRef = useRef(-1);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [volumeStep, setVolumeStepState] = useState(DEFAULT_VOLUME_STEP);
  const [history, setHistory] = useState<RoundOutcome[]>([]);

  if (!audioRef.current && typeof window !== "undefined") {
    audioRef.current = new AudioEngine();
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
  }, []);

  const setVolumeStep = useCallback((next: number) => {
    const step = Math.min(Math.max(Math.round(next), 0), VOLUME_STEPS);
    setVolumeStepState(step);
    audioRef.current?.setVolume(stepToVolume(step));
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
    socket.on("room:error", (e) => setError(e.message));
    socket.on("room:closed", () => {
      writeSession(null);
      setRoom(null);
    });

    return () => {
      socket.close();
      socketRef.current = null;
      audioRef.current?.dispose();
    };
  }, []);

  // ------------------------------------------------------------------- audio
  //
  // The server drives audio through the room phase, so this effect is the only
  // place playback is decided. Components never touch the AudioEngine.

  const phase = room?.phase;
  const round = room?.round ?? null;
  const revealNext = room?.reveal?.nextPreviewUrl ?? null;
  const reveal = room?.reveal ?? null;

  // Record how each Round went as its reveal lands. The server sends only the
  // current Round's results, so a running history has to be kept here.
  useEffect(() => {
    if (!reveal || !playerId) return;
    setHistory((prev) => {
      if (prev[reveal.index] !== undefined) return prev;
      const mine = reveal.results.find((r) => r.playerId === playerId);
      const next = prev.slice();
      next[reveal.index] = mine?.correct
        ? "correct"
        : mine?.choiceId
          ? "wrong"
          : "missed";
      return next;
    });
  }, [reveal, playerId]);

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

    if (phase === "playing" && playedRef.current !== round.index) {
      playedRef.current = round.index;
      audio.play(round.previewUrl, round.clipMs);
    }
  }, [phase, round]);

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

  const setConfig = useCallback((config: MatchConfig) => {
    socketRef.current?.emit("room:config", config);
  }, []);

  const startMatch = useCallback(() => {
    setError(null);
    setHistory([]);
    readyForRef.current = -1;
    playedRef.current = -1;
    socketRef.current?.emit("match:start");
  }, []);

  const answer = useCallback((index: number, choiceId: string) => {
    socketRef.current?.emit("round:answer", { index, choiceId });
  }, []);

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
    createRoom,
    joinRoom,
    setConfig,
    startMatch,
    answer,
    leave,
    serverNow,
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
