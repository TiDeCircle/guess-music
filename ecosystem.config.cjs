/**
 * PM2 process definition for the VPS.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * IMPORTANT: this app must run as exactly one process. Rooms live in the
 * memory of the process that created them (see src/server/rooms.ts and
 * docs/adr/0004), so a second instance would serve players a room its own
 * memory knows nothing about. Do not switch this to cluster mode or raise
 * `instances`.
 */
module.exports = {
  apps: [
    {
      name: "guess-music",
      cwd: "/var/www/guess-music",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",

      env: {
        NODE_ENV: "production",
        // 3000 newportfolio, 3001 nptsx, 3002 wavelength, 3003 editshare.
        PORT: 3004,
        // Nginx is the only thing that should reach this port.
        HOST: "127.0.0.1",
      },

      // A restart drops every live room, so avoid churn: no watching, and a
      // generous memory ceiling.
      watch: false,
      max_memory_restart: "500M",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,

      time: true,
      merge_logs: true,
      error_file: "/home/tide/.pm2/logs/guess-music-error.log",
      out_file: "/home/tide/.pm2/logs/guess-music-out.log",
    },
  ],
};
