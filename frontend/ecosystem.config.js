module.exports = {
    apps: [
        {
            name: "sensor-monitor",
            script: "./scripts/tuya-sensor-monitor.js",
            watch: false,
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000,
            env: {
                NODE_ENV: "production",
            },
        }
    ]
}
