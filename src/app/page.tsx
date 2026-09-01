"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/client/useGame";
import { useLang } from "@/client/i18n";
import { Shell } from "@/client/components/Shell";
import { HomeScreen } from "@/client/components/HomeScreen";
import { LobbyScreen } from "@/client/components/LobbyScreen";
import { PlayScreen } from "@/client/components/PlayScreen";
import { CountdownScreen } from "@/client/components/CountdownScreen";
import { RevealScreen } from "@/client/components/RevealScreen";
import { FinishedScreen } from "@/client/components/FinishedScreen";

/**
 * One page. Which screen shows is a function of the room phase the server
 * broadcasts — the client never decides it has moved on.
 */
export default function Page() {
  const game = useGame();
  const { t } = useLang();
  /** Waiting on create/join to come back. */
  const [joining, setJoining] = useState(false);
  /** Host pressed start; the server is fetching a pool from iTunes. */
  const [starting, setStarting] = useState(false);

  const phase = game.room?.phase;
  /** A Round is on screen in one form or another. */
  const inRound = phase === "loading" || phase === "playing";

  // Starting a match is not instant. Clear the flag once the room has actually
  // left the lobby — and note that creating a room lands in `lobby` too, which
  // is why joining and starting cannot share one flag.
  useEffect(() => {
    if (phase && phase !== "lobby" && phase !== "finished") setStarting(false);
  }, [phase]);

  useEffect(() => {
    if (game.error) {
      setJoining(false);
      setStarting(false);
    }
  }, [game.error]);

  /**
   * A round in progress has something to lose; the lobby and the recap do
   * not. Only the former is worth a confirm before it throws the room away.
   */
  const handleLeave = () => {
    const midMatch = inRound || phase === "reveal";
    if (midMatch && !window.confirm(t("leaveConfirm"))) return;
    game.leave();
  };

  return (
    <Shell
      status={game.status}
      volumeStep={game.volumeStep}
      onVolumeChange={game.setVolumeStep}
      onLeave={game.room ? handleLeave : undefined}
    >
      {game.error && (
        <div
          role="alert"
          className="label mb-8 flex items-center justify-between border border-accent px-4 py-3 text-accent"
        >
          <span>{game.error}</span>
          <button type="button" onClick={game.clearError} aria-label="close">
            ✕
          </button>
        </div>
      )}

      {!game.room && (
        <HomeScreen
          rooms={game.roomList}
          busy={joining || game.status !== "online"}
          onCreate={async (name) => {
            setJoining(true);
            // Take the audio permission on the same tap that creates the room:
            // it is a real user gesture, and asking again later is friction.
            await game.unlockAudio();
            await game.createRoom(name);
            setJoining(false);
          }}
          onJoin={async (code, name) => {
            setJoining(true);
            await game.unlockAudio();
            await game.joinRoom(code, name);
            setJoining(false);
          }}
        />
      )}

      {game.room && (phase === "lobby" || phase === "loading") && !game.room.round && (
        <LobbyScreen
          room={game.room}
          playerId={game.playerId}
          audioUnlocked={game.audioUnlocked}
          onUnlockAudio={() => void game.unlockAudio()}
          onConfig={game.setConfig}
          onLock={game.setLocked}
          onStart={() => {
            setStarting(true);
            game.startMatch();
          }}
          onKick={game.kick}
          onSetMuted={game.setMuted}
          starting={starting}
        />
      )}

      {/* The three seconds that open a Match get the screen to themselves —
          see CountdownScreen. Every later Round opens with a short beat that
          the play screen shows in place. */}
      {game.room?.round && game.countingIn && (
        <CountdownScreen
          startAt={game.room.round.startAt}
          serverNow={game.serverNow}
        />
      )}

      {game.room?.round && inRound && !game.countingIn && (
        <PlayScreen
          room={game.room}
          playerId={game.playerId}
          history={game.history}
          wrongGuesses={game.wrongGuesses}
          level={game.myLevel}
          serverNow={game.serverNow}
          onAnswer={(index, guess) => void game.answer(index, guess)}
          onUnlock={game.unlock}
          onReplay={game.replayClip}
          reactions={game.reactions}
          onReact={game.react}
        />
      )}

      {game.room && phase === "reveal" && (
        <RevealScreen
          room={game.room}
          playerId={game.playerId}
          reactions={game.reactions}
          onReact={game.react}
        />
      )}

      {game.room && phase === "finished" && (
        <FinishedScreen
          room={game.room}
          playerId={game.playerId}
          previewingId={game.previewingId}
          onTogglePreview={game.togglePreview}
          onPlayAgain={() => {
            setStarting(true);
            game.startMatch();
          }}
          onBackToLobby={game.returnToLobby}
        />
      )}

      {game.status === "offline" && (
        <p className="label mt-12 text-accent">{t("reconnecting")}</p>
      )}
    </Shell>
  );
}
