module.exports = {
    apps: [
        {
            name: "sensor-monitor",
            script: "./scripts/sensors/daemon.js",
            watch: false,
            autorestart: true,
            // Never give up: a long network/Supabase outage at boot must not leave the sensors off.
            // Restarts back off exponentially (100ms → 15s max) instead of counting towards a limit.
            max_restarts: 1000000,
            min_uptime: 10000,
            exp_backoff_restart_delay: 100,
            kill_timeout: 5000,  // lets the daemon flush queued DB writes on restart
            env: {
                NODE_ENV: "production",
            },
        }
    ]
}
