//This middleware queues requests to some endpoints

let ipQueue = {};
let ipRunningRequest = {};

function tryServeNextRequest(clientIp) {
    if (ipRunningRequest[clientIp] == null) ipRunningRequest[clientIp] = false;
    
    //Check if we can run a new request
    if (!ipRunningRequest[clientIp]) {
        let pendingRequests = ipQueue[clientIp];
        if (pendingRequests.length === 0) return; //Don't do anything
        
        let {req, res, next} = pendingRequests.shift();
        
        res.once("finish", () => {
            ipRunningRequest[clientIp] = false;
            tryServeNextRequest(clientIp);
        });
        
        ipRunningRequest[clientIp] = true;
        next();
    }
}

module.exports = function() {
    return async (req, res, next) => {
        if (!ipQueue[req.clientIp]) ipQueue[req.clientIp] = [];
        ipQueue[req.clientIp].push({
            req: req,
            res: res,
            next: next
        });
        
        tryServeNextRequest(req.clientIp);
    };
}

