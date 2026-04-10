module.exports = {
    name: "aipoc",
    apps: [
        {
            name: "aipoc",
            script: "node_modules/.bin/next",
            args: "start",
            cwd: "/home/administrator/apps/AIPOC/releases/main_v1/Skylite-Education-Frontend",
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: "production",
                PORT: 3004,
            },
        },
    ],
};