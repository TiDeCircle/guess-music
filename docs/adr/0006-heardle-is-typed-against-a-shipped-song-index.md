# Heardle is typed, against a shipped song index

Heardle first shipped here as four options with a clip that grew on the server clock. That was wrong twice over. The clip growing on its own made the round about reacting rather than knowing, and four options meant a player could win by recognising a title on screen — which is the thing Heardle exists not to reward.

So the mode was rebuilt the way the original works: you hear one second, and you type the song. If you do not know it, you spend a level to hear more, for fewer points. A wrong guess spends a level too, so guessing and skipping cost the same thing, and the ladder is the only currency.

Typing Thai song titles against a clock is not viable on its own — more than half the shipped catalogue carries a suffix like `(Love Effects) [feat. BILLKIN]`, and titles run to 74 characters. Two things make it work. The answer box searches a list, so the normal path is picking a real title rather than spelling one. And grading happens on the server against the title with its suffix stripped, so free text still wins when the list has never heard of the song.

The list has to be large or it becomes the answer key: a picker built from the match pool would narrow to the right song in two keystrokes. `scripts/build-song-index.ts` pulls every shipped artist's full catalogue through `lookup` and writes 16,164 songs by 1,544 artists to `public/song-index.json` — 527KB, 180KB over the wire, fetched once and only when a Heardle round loads.

## Consequences

- Nothing about the answer reaches the client before the reveal. A typed round sends no options at all, which is stronger than the Quiz rounds ever were.
- Heardle plays pools too thin for Quiz. With no decoys to find, an artist with four songs is a playable match.
- Grading must keep Thai marks. `\p{L}\p{N}` silently drops vowel signs and tone marks, which are Unicode *marks*, and thirteen pairs in the shipped catalogue collapse together that way — ฝุ่น with ฝน, จูบ with จีบ, หนึ่งคืน with หนึ่งคน. Every one of those would be a round graded wrong.
- The verdict rides the answer's ack rather than the room snapshot. A snapshot goes to everyone by definition, and in the competitive mode a wrong guess is nobody else's business; the co-op mode broadcasts its tried titles deliberately, because a shared ladder is unplayable if teammates cannot see what has been spent.
- Unlock levels are public. How much music somebody has bought is not a hint about the song, and watching a rival still sitting on one second is most of what makes the competitive mode fun.
- Rounds are slower: the window is the last unlock plus twenty-five seconds, because typing a Thai title on a phone is not a reflex. The round still closes the moment everyone has committed.
- The index is a build artifact that goes stale as charts move. That is survivable precisely because it is only a typing aid — a song it lacks is still winnable by typing the title out.
