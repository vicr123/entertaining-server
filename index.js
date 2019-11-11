const express = require('express');
const expressWs = require('express-ws');
const nconf = require('nconf');
const winston = require('winston');
const db = require('./db');
const authMiddleware = require("./auth-middleware");
const app = express();

let server = null;

function teardown() {
    winston.log("info", "Stopping server...");
    server.close();
    
    winston.log("info", "Giving all websockets 5 seconds to close...");
    setTimeout(() => {
        process.exit(0);
    }, 5000);
}

function initConfiguration() {
    //Initialize application configuration
    winston.log("verbose", "Loading application configuration...");
    
    nconf.argv();
    nconf.env();
    nconf.file("./config.json");
    nconf.defaults({
        "port": 3000,
        "rootRedirect": "https://entertaining.games"
    });
}

function initExpress() {
    return new Promise((res, rej) => {
        const port = nconf.get("port");
        const rootRedirect = nconf.get("rootRedirect");
        
        //Prepare Express
        expressWs(app);
        
        app.use(express.json());
        app.use(authMiddleware);
        app.use("/api", require("./api/api"));
        
        //Redirect all calls to /
        app.all("/*", function(req, res) {
            res.redirect(rootRedirect);
        });
        
        server = app.listen(port, err => {
            if (err) {
                winston.log("error", "Couldn't start the server");
                rej(err);
            } else {
                winston.log("info", `Server is running on port ${port}`);
                res();
            }
        });
        
        process.on("SIGINT", teardown);
        process.on("SIGTERM", teardown);
    });
}

(async () => {
    winston.configure({
        level: "silly",
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.simple())
            })
        ]
    });
    
    initConfiguration();
    await db.init();
    await initExpress();
})();