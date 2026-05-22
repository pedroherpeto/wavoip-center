// PM2 ecosystem para producao sem Docker.
//   cd backend && npm run build && cd ..
//   cd frontend && npm run build && cd ..
//   pm2 start ecosystem.config.cjs
//   pm2 logs
//   pm2 monit
const path = require("path");

module.exports = {
  apps: [
    {
      name: "wavoip-pabx-backend",
      cwd: path.resolve(__dirname, "backend"),
      script: "dist/server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        HOST: "0.0.0.0",
      },
      error_file: path.resolve(__dirname, "logs/pabx-error.log"),
      out_file: path.resolve(__dirname, "logs/pabx-out.log"),
      merge_logs: true,
      time: true,
    },
    {
      name: "wavoip-pabx-frontend",
      cwd: path.resolve(__dirname, "frontend"),
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
      error_file: path.resolve(__dirname, "logs/panel-error.log"),
      out_file: path.resolve(__dirname, "logs/panel-out.log"),
      merge_logs: true,
      time: true,
    },
  ],
};
