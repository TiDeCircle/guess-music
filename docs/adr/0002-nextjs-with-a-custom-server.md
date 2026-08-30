# Next.js behind a custom server, not Vercel

Socket.io needs a process that stays alive and owns the HTTP server so it can accept WebSocket upgrades. `next start` offers no way in, and serverless platforms offer no long-lived process at all, so Vercel is not an option for this app.

We run `tsx server.ts`, which boots Next as a request handler inside our own `http.createServer` and attaches Socket.io to it. `tsx` is therefore a production dependency, not a dev one.

We briefly planned a split Vite SPA plus a separate Node service instead. We changed our minds on finding that this machine already runs *wavelength*, a Socket.io game deployed exactly this way behind PM2 and Nginx. Matching a deployment shape that is already proven here is worth more than the theoretical tidiness of splitting the two halves apart, and the shared game logic in `src/shared/` gives us the type safety that split would have bought.
