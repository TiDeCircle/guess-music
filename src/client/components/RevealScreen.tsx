"use client";

import type { RoomState } from "@/shared/types";
import type { ReactionId } from "@/shared/protocol";
import { MODES, unlockedMs } from "@/shared/modes";
import { useLang, type StringKey } from "@/client/i18n";
import { FieldLabel } from "./Shell";
import { ReactionPicker } from "./ReactionPicker";

/**
 * The moment the whole Lockstep design exists for: every player finds out at
 * the same instant. Correct and wrong are told apart by weight and a
 * strikethrough, not by colour.
 *
 * Each row says what that player actually answered and what it cost them —
 * which second they hit it on in Quiz, how much of the song they had bought in
 * Heardle. Without that the reveal only said who was right, and the whole
 * argument after a round is about who was faster.
 */
export function RevealScreen({
  room,
  playerId,
  reactions,
  onReact,
}: {
  room: RoomState;
  playerId: string | null;
  reactions?: Record<string, { reaction: ReactionId; id: string } | undefined>;
  onReact?: (reaction: ReactionId) => void;
}) {
  const { t } = useLang();
  const reveal = room.reveal;
  if (!reveal) return null;

  const byId = new Map(room.players.map((p) => [p.id, p]));
  const mode = MODES[room.config.mode];
  // A co-op round is one result wearing every name: everyone scored the same
  // thing off the same guess, so it is reported once, as the room.
  const shared = mode.shared;
  const stagesMs = room.round?.stagesMs ?? [];

  /** Quiz sends choice ids; the title lives on the round that is still open. */
  const titleOf = (choiceId: string) =>
    room.round?.choices.find((c) => c.id === choiceId)?.title ?? choiceId;

  const rows = shared
    ? reveal.results.slice(0, 1)
    : // Ordered by the round, not by the match: right answers first and the
      // quickest of those at the top, because "who got it faster" is the
      // question everyone actually asks here.
      [...reveal.results].sort((a, b) => {
        const rank = (r: (typeof reveal.results)[number]) =>
          r.correct ? 0 : r.choiceId !== null ? 1 : 2;
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        if (a.correct && b.correct) {
          if (mode.typed && a.level !== b.level) return a.level - b.level;
          return (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0);
        }
        return b.totalScore - a.totalScore;
      });

  const firstCorrect = rows.find((r) => r.correct);

  return (
    <div key={reveal.index} className="grid gap-10 md:grid-cols-12 md:gap-8">
      <section className="enter md:col-span-6">
        <FieldLabel>{t("theAnswer")}</FieldLabel>
        <div className="mt-4 flex items-start gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reveal.track.artworkUrl}
            alt=""
            width={160}
            height={160}
            className="h-28 w-28 shrink-0 border border-ink object-cover md:h-40 md:w-40"
          />
          <div>
            <h2
              className="font-bold leading-[1.05] tracking-[-0.02em]"
              style={{ fontSize: "var(--text-title)" }}
            >
              {reveal.track.title}
            </h2>
            <p className="label mt-3 text-grey-500">{reveal.track.artist}</p>
          </div>
        </div>
      </section>

      {/* One step behind the answer: the song is what everyone looks at first,
          and the scores mean more once you know what the song was. */}
      <section className="enter md:col-span-6" style={{ animationDelay: "60ms" }}>
        <FieldLabel>{shared ? t("teamScore") : t("thisRound")}</FieldLabel>
        <ul className="mt-2">
          {rows.map((r) => {
            const player = byId.get(r.playerId);
            if (!player) return null;
            const answered = r.choiceId !== null;

            /**
             * What it took them. In Quiz that is the clock; in Heardle the
             * clock is a backstop and the real currency is how much of the song
             * they had to buy, so it reports the ladder instead.
             */
            /**
             * Every guess, in order, resolved to something a person can read.
             *
             * A wrong final answer is already the last thing in `tried`, so
             * appending `choiceId` unconditionally printed it twice — and in
             * Quiz the first copy came out as the raw iTunes track id, because
             * only the final answer was ever put through `titleOf`.
             */
            const guesses = [
              ...r.tried.map((t) => ({
                text: titleOf(t.text),
                correct: false,
                by: t.byPlayerId,
              })),
              ...(r.correct && r.choiceId
                ? [{ text: titleOf(r.choiceId), correct: true, by: r.byPlayerId }]
                : []),
            ];

            const cost = !answered
              ? null
              : mode.typed
                ? `${t("unlockedTo")} ${Math.round(unlockedMs(stagesMs, r.level) / 1000)} ${t("seconds")}`
                : `${((r.elapsedMs ?? 0) / 1000).toFixed(1)} ${t("seconds")}`;

            return (
              <li key={r.playerId} className="border-b border-grey-300 py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span
                    className={
                      r.correct
                        ? "font-semibold"
                        : answered
                          ? "text-grey-500"
                          : "text-grey-300"
                    }
                    style={{ fontSize: "var(--text-body)" }}
                  >
                    {shared ? t("teamName") : player.name}
                    {!shared && r.playerId === playerId ? ` · ${t("you")}` : ""}
                    {/* Only worth saying when more than one person got it. */}
                    {!shared && r === firstCorrect && rows.filter((x) => x.correct).length > 1 && (
                      <span className="label ml-3 text-accent">{t("fastest")}</span>
                    )}
                    {reactions?.[r.playerId] && (
                      <span
                        key={reactions[r.playerId]?.id}
                        className="animate-fade-in relative ml-2 rounded-lg border border-accent bg-paper px-2 py-1 text-[11px] font-medium text-accent"
                      >
                        {t(`reaction.${reactions[r.playerId]!.reaction}` as StringKey)}
                        <span
                          aria-hidden
                          className="absolute -left-[3px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 border-b border-l border-accent bg-paper"
                        />
                      </span>
                    )}
                  </span>
                  <span className="numeric shrink-0 font-semibold">
                    {r.gained > 0 ? `+${r.gained}` : "0"}
                  </span>
                </div>

                {/* Every guess in the order it was made, the rejected ones
                    struck through. A Heardle player who spent both rungs and
                    ran out of time has no final answer at all, and "they never
                    answered" is not what happened — they answered twice. */}
                <p className="label mt-1 text-grey-500">
                  {guesses.length === 0 ? (
                    t("noAnswer")
                  ) : (
                    <>
                      {t("answeredWith")}{" "}
                      {guesses.map((g, i) => {
                        // In co-op the name matters here and nowhere else: one
                        // person guessed and the whole room was scored for it,
                        // so every guess says whose rung it spent.
                        const who = shared && g.by ? byId.get(g.by)?.name : null;
                        return (
                          <span key={`${g.text}-${i}`}>
                            {i > 0 ? " · " : ""}
                            {who ? `${who}: ` : ""}
                            <span
                              className={g.correct ? "text-ink" : "line-through decoration-1"}
                            >
                              {g.text}
                            </span>
                          </span>
                        );
                      })}
                      {cost ? ` · ${cost}` : ""}
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {onReact && (
        <div className="enter md:col-span-12" style={{ animationDelay: "120ms" }}>
          <ReactionPicker onReact={onReact} />
        </div>
      )}
    </div>
  );
}
