module.exports = {
    apps: [{
        name: "inventory-sensors",
        script: "./scripts/tuya-poll.js",
        watch: false,
        env: {
            NODE_ENV: "production",
        },
        // Estas variables se cargarán del sistema o del archivo .env.local si usas dotenv,
        // pero para PM2 es mejor definirlas aquí si no las lee el script
    }]
}
