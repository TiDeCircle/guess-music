# Rooms live in process memory

Room and Match state is held in a `Map` inside the Node process. There is no database and no Redis.

A room's whole life is one sitting: a few friends, a few minutes, and then it is over. Persisting that would add a datastore, a schema, and a migration story to a project that would otherwise have none, in exchange for surviving a restart that happens roughly never.

## Consequences

- **The app must run as exactly one PM2 instance in fork mode.** A second instance would serve players a room its own memory has never heard of. This is enforced by convention in `ecosystem.config.cjs` and is the first thing to check if players report being bounced out of rooms.
- A deploy or a crash drops every live room. Players get a fresh start, not an error screen.
- Reconnect is a 30-second grace period inside the same process, not durable state. Refreshing works; the server restarting does not.
