module.exports = {
  apps: [
    {
      name: 'octal-vote',
      script: 'pnpm',
      args: 'start',
      cwd: '/var/www/octal-vote',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Restart on crash, max 5 restarts in 10 seconds
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'face-service',
      script: '/var/www/octal-vote/face-service/venv/bin/uvicorn',
      args: 'main:app --host 127.0.0.1 --port 8001 --workers 1',
      cwd: '/var/www/octal-vote/face-service',
      interpreter: 'none',
      env: {
        PATH: '/var/www/octal-vote/face-service/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      },
      max_restarts: 5,
      restart_delay: 5000,
    },
  ],
};
