const nconf = require('nconf');
const winston = require('winston');
const fs = require("fs");

function report(req, res) {
    try {
        if (!req.authUser) {
            winston.log('verbose', `Entertaining Game Report was rejected because the user was not authenticated`);
            res.sendStatus(401);
            return;
        }
    
        let report = req.body;
        if (!report.picture || !report.reason) {
            winston.log('verbose', `Entertaining Game Report was rejected because fields were missing`);
            res.sendStatus(400);
            return;
        }
    
        let baseFilename = `${nconf.get("reportsLocation")}/${(new Date().getTime()).toString()}-${req.authUser.username}`;
    
        fs.writeFile(`${baseFilename}.json`, JSON.stringify({
            "reason": report.reason
        }), () => {});
        fs.writeFile(`${baseFilename}.png`, Buffer.from(report.picture, 'base64'), () => {});
    
        winston.log('info', `Entertaining Game Report ${baseFilename} was submitted`);
    
        //Save the content report
        res.send({
            status: "ok"
        });
    } catch (err) {
        winston.log('warn', `Entertaining Game Report was unable to be saved`);
        res.sendStatus(500);
        return;
    }
}

report.init = () => {
    fs.mkdir(nconf.get("reportsLocation"), {
        recursive: true
    }, () => { });
}

module.exports = report;