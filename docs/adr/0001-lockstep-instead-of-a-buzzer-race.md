# Lockstep rounds instead of a buzzer race

The obvious design for a multiplayer song quiz is a race: the first player to answer correctly takes the round. We rejected it. Audio does not start at the same instant on every device — network jitter, buffering, and per-browser autoplay behaviour easily separate two players by several hundred milliseconds, and none of it is under our control. In a race that gap decides the round, so players would be losing to their phones rather than to each other.

Instead every Round opens for a fixed Answer Window on the server's clock. All players answer within the same window, nobody's answer ends the round for anyone else, and the reveal lands for everyone at once. Speed still matters — it is worth up to half the points — but as a bonus, not as an elimination.

## Consequences

- The server owns all timing. Clients receive a deadline timestamp and count down locally against a measured clock offset; they never decide when a round ends.
- A Round cannot start until every connected client reports its audio buffered (with a timeout), which is the `loading` phase in `RoomPhase`.
- Rounds have a predictable length, so a Match takes a predictable amount of time.
