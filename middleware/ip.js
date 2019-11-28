const db = require('../db');
const winston = require('winston');
const nconf = require('nconf');

let logger = winston.createLogger({
    level: "silly",
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        })
    ]
});

module.exports = function() {
    nconf.defaults({
        trustProxy: false,
        proxyLimit: 0
    });
    
    return async (req, res, next) => {
        let clientIp;
        if (nconf.get("trustProxy")) {
            let forwarded = req.get("X-Forwarded-For");
            if (forwarded) {
                let forwardedIps = forwarded.split(",");
                let firstIp;
                if (forwardedIps.length >= nconf.get("proxyLimit")) {
                    firstIp = forwardedIps[0];
                } else {
                    firstIp = forwardedIps[forwardedIps.length - 1 - nconf.get("proxyLimit")];
                }
                
                if (firstIp.includes(':')) {
                    //Azure sometimes adds a port to this header
                    //Make sure we're actually dealing with a port and not an IPv6 address
                    let ipParts = firstIp.split(":");
                    if (ipParts.length === 2) firstIp = ipParts[0];
                }
                
                clientIp = firstIp;
            } else {
                clientIp = req.connection.remoteAddress;
            }
        } else {
            clientIp = req.connection.remoteAddress;
        }
        
        req.clientIp = clientIp;
        logger.log("silly", `REQ ${clientIp}: ${req.method} ${req.path}`);
        
        next();
    };
}

