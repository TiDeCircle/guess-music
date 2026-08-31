import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  answerSchema,
  configSchema,
  lockSchema,
  createRoomSchema,
  joinRoomSchema,
  readySchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@/shared/protocol";
import { RoomError, RoomStore, toRoomState, type Room } from "./rooms";
import { EmptyCatalogError, ThinArtistError } from "./catalog";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Which room and player a live socket belongs to. */
type SocketBinding = { code: string; playerId: string };

export function attachSocketServer(httpServer: HttpServer): Server {
  const io: Server<ClientToServerEvents, ServerToClientEvents> = new Server(
    httpServer,
    {
      // Nginx terminates TLS and proxies to loopback, so same-origin only.
      cors: { origin: false },
      // Matches the long proxy_read_timeout in deploy/nginx: a player parked on
      // the lobby screen sends nothing for minutes and must not be cut off.
      pingInterval: 20_000,
      pingTimeout: 20_000,
    },
  );

  const bindings = new Map<string, SocketBinding>();

  /**
   * The list is pushed rather than polled, but a single join can fire several
   * changes in a row, so the broadcast is collapsed into one tick.
   */
  let listingTimer: NodeJS.Timeout | null = null;
  function broadcastListing(): void {
    if (listingTimer) return;
    listingTimer = setTimeout(() => {
      listingTimer = null;
      io.to(BROWSER_CHANNEL).emit("rooms:listing", store.listRooms());
    }, 150);
    listingTimer.unref?.();
  }

  const store = new RoomStore({
    onState(room) {
      io.to(roomChannel(room.code)).emit("room:state", toRoomState(room));
    },
    onClosed(code, reason) {
      io.to(roomChannel(code)).emit("room:closed", reason);
    },
    onListingChanged() {
      broadcastListing();
    },
  });
  store.start();

  io.on("connection", (socket: GameSocket) => {
    socket.on("clock:sync", (ack) => {
      if (typeof ack === "function") ack(Date.now());
    });

    socket.on("room:create", (payload, ack) => {
      if (typeof ack !== "function") return;
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: "ชื่อไม่ถูกต้อง" });

      const { room, player } = store.createRoom(parsed.data.name, socket.id);
      bind(socket, room, player.id);
      ack({
        ok: true,
        data: { code: room.code, playerId: player.id, sessionId: player.sessionId },
      });
      pushState(room);
    });

    socket.on("room:join", (payload, ack) => {
      if (typeof ack !== "function") return;
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: "รหัสห้องหรือชื่อไม่ถูกต้อง" });

      try {
        const { room, player } = store.joinRoom(
          parsed.data.code,
          parsed.data.name,
          socket.id,
          parsed.data.sessionId,
        );
        bind(socket, room, player.id);
        ack({
          ok: true,
          data: { code: room.code, playerId: player.id, sessionId: player.sessionId },
        });
        pushState(room);
      } catch (err) {
        ack({ ok: false, error: messageFor(err) });
      }
    });

    socket.on("room:config", (payload) => {
      const ctx = contextFor(socket);
      if (!ctx) return;
      const parsed = configSchema.safeParse(payload);
      if (!parsed.success) return fail(socket, "bad_config", "ค่าที่ตั้งไม่ถูกต้อง");
      try {
        store.setConfig(ctx.room, ctx.playerId, parsed.data);
      } catch (err) {
        fail(socket, "config", messageFor(err));
      }
    });

    socket.on("match:start", () => {
      const ctx = contextFor(socket);
      if (!ctx) return;
      // startMatch awaits the iTunes fetch, so failures arrive here rather than
      // as an unhandled rejection.
      store.startMatch(ctx.room, ctx.playerId).catch((err) => {
        fail(socket, "start", messageFor(err));
        // The room stayed in lobby; make sure clients stop showing a spinner.
        pushState(ctx.room);
      });
    });

    socket.on("rooms:watch", () => {
      void socket.join(BROWSER_CHANNEL);
      // Answer straight away rather than leaving the home screen blank until
      // something in some other room happens to change.
      socket.emit("rooms:listing", store.listRooms());
    });

    socket.on("rooms:unwatch", () => {
      void socket.leave(BROWSER_CHANNEL);
    });

    socket.on("room:lock", (payload) => {
      const ctx = contextFor(socket);
      if (!ctx) return;
      const parsed = lockSchema.safeParse(payload);
      if (!parsed.success) return;
      try {
        store.setLocked(ctx.room, ctx.playerId, parsed.data.locked);
      } catch (err) {
        fail(socket, "lock", messageFor(err));
      }
    });

    socket.on("match:lobby", () => {
      const ctx = contextFor(socket);
      if (!ctx) return;
      try {
        store.returnToLobby(ctx.room, ctx.playerId);
      } catch (err) {
        fail(socket, "lobby", messageFor(err));
      }
    });

    socket.on("round:ready", (payload) => {
      const ctx = contextFor(socket);
      if (!ctx) return;
      const parsed = readySchema.safeParse(payload);
      if (!parsed.success) return;
      store.markReady(ctx.room, ctx.playerId, parsed.data.index);
    });

    socket.on("round:answer", (payload) => {
      const ctx = contextFor(socket);
      if (!ctx) return;
      const parsed = answerSchema.safeParse(payload);
      if (!parsed.success) return;
      const outcome = store.submitAnswer(
        ctx.room,
        ctx.playerId,
        parsed.data.index,
        parsed.data.choiceId,
      );
      // Heardle keeps the round open after a wrong guess, so the guesser has to
      // learn immediately which option is gone — the reveal is far too late.
      if (outcome && !outcome.correct) {
        socket.emit("round:strike", {
          index: parsed.data.index,
          choiceId: parsed.data.choiceId,
        });
      }
    });

    socket.on("disconnect", () => {
      bindings.delete(socket.id);
      const room = store.disconnect(socket.id);
      if (room) {
        pushState(room);
        broadcastListing();
      }
    });
  });

  function bind(socket: GameSocket, room: Room, playerId: string): void {
    bindings.set(socket.id, { code: room.code, playerId });
    socket.join(roomChannel(room.code));
  }

  function contextFor(socket: GameSocket): { room: Room; playerId: string } | null {
    const binding = bindings.get(socket.id);
    if (!binding) return null;
    const room = store.get(binding.code);
    if (!room) return null;
    return { room, playerId: binding.playerId };
  }

  function pushState(room: Room): void {
    io.to(roomChannel(room.code)).emit("room:state", toRoomState(room));
  }

  function fail(socket: GameSocket, code: string, message: string): void {
    socket.emit("room:error", { code, message });
  }

  return io as Server;
}

const roomChannel = (code: string) => `room:${code}`;

/** Everyone sitting on the home screen watching the room list. */
const BROWSER_CHANNEL = "rooms:browser";

function messageFor(err: unknown): string {
  if (err instanceof RoomError) return err.message;
  if (err instanceof ThinArtistError) {
    return `${err.artist} มีเพลงใน iTunes ไม่พอเล่น ลองศิลปินคนอื่น`;
  }
  if (err instanceof EmptyCatalogError) return "ตัวเลือกนี้ยังไม่มีเพลง ลองอันอื่น";
  // Anything else is ours to fix, not the player's to read.
  console.error("[socket]", err);
  return "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}
