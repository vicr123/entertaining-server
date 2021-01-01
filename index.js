const express = require('express');
const expressWs = require('express-ws');
const nconf = require('nconf');
const winston = require('winston');
const showdown = require('showdown');
const fs = require('fs');
const db = require('./db');
const ipMiddleware = require("./middleware/ip");
const authMiddleware = require("./middleware/auth");
const report = require('./api/report');
const app = express();

let server = null;
let tearingDown = false;

function teardown() {
    if (tearingDown) {
        //Kill the process immediately
        process.exit(0);
    } else {
        winston.log("info", "Stopping server...");
        server.close();
        
        winston.log("info", "Giving all websockets 5 seconds to close...");
        setTimeout(() => {
            process.exit(0);
        }, 5000);
        
        tearingDown = true;
    }
}

function initConfiguration() {
    //Initialize application configuration
    winston.log("verbose", "Loading application configuration...");
    
    nconf.argv();
    nconf.env();
    nconf.file("./config.json");
    nconf.defaults({
        "port": 3000,
        "rootAction": {
            action: "redirect",
            location: "https://entertaining.games"
        }
    });

    report.init();
}

function initExpress() {
    return new Promise((res, rej) => {
        const port = nconf.get("port");
        const rootAction = nconf.get("rootAction");
        
        //Prepare Express
        expressWs(app);
        
        app.use(express.json({
            limit: "20mb"
        }));
        app.use(authMiddleware);
        app.use(ipMiddleware());
        app.use("/api", require("./api/api"));
        
        app.get("/info/:infoFile", async function(req, res) {
            let converter = new showdown.Converter();
            if (fs.existsSync(`${__dirname}/documents/${req.params.infoFile}.md`)) {
                fs.readFile
                fs.readFile(`${__dirname}/documents/${req.params.infoFile}.md`, {
                    encoding: "utf8"
                }, (err, data) => {
                    if (err) {
                        res.status(500).send();
                        return;
                    }
                    res.status(200).send(converter.makeHtml(data));
                });
            } else {
                res.status(404).send();
            }
        });
        
        if (rootAction.action === "redirect") {
            //Redirect all calls to /
            app.all("/*", function(req, res) {
                res.redirect(rootAction.location);
            });
        } else if (rootAction.action === "serve") {
            //Serve all static pages
            app.use(express.static(rootAction.location, rootAction.options));
        }
        
        
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