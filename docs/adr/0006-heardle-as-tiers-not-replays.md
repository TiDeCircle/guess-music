# Heardle scores by tier, on one continuous clip

The original Heardle plays one second, waits for a guess, then replays from the start with two seconds, and so on. That shape does not survive Lockstep: every stage would need its own answer window, so one round would run six windows back to back — two minutes for something the Quiz mode does in fifteen seconds, with seven players sitting through five stages they did not need.

So the clip is played once and simply keeps going, and the stage marks become score tiers rather than replays. A player who names the song inside the first second is paid the top tier; one who needs eleven seconds is paid the bottom. The round still closes the moment everyone has committed, exactly as Quiz does, and the whole Lockstep machinery — one server clock, one deadline, one reveal — is untouched.

The tiers are pinned to the same endpoints as Quiz: the top tier pays what an instant Quiz answer pays, the bottom pays what an answer on the buzzer pays. A match is therefore worth the same whichever mode a room picks, so the choice stays about how you want to play rather than which mode farms more points.

## Consequences

- Difficulty had to mean something new here, since there is no fixed clip to shorten. It tightens the ladder instead: on extreme the top tier is open for one second and the music is gone by eight, against two and eighteen on easy.
- Two wrong guesses are allowed, not three: with four options a third would leave only the right one standing.
- A wrong guess is the first thing in this game that ends a round for some players and not others, so `GameMode.judge` returns whether the guess was final rather than the room assuming it was.
- Strikes are private in the competitive mode and broadcast in the co-op one. That split is the whole difference between them, and it is why a strike travels on its own socket event rather than in the room snapshot — a snapshot goes to everybody by definition.
- Co-op scores every connected player the same number off one guess. That keeps one score field instead of a second team-score concept, at the cost of a standings table full of ties, which the end screen collapses.
