const winston = require('winston');

class Game {
    #ws;
    #username;
    #userId;
    
    constructor(ws, username, userId) {
        this.#ws = ws;
        this.#username = username;
        this.#userId = userId;
        
        
        ws.on("close", (code, reason) => {
            winston.log('silly', `Entertaining Mines client closed with close code ${code}`);
        });
        
        winston.log('verbose', `Entertaining Mines client initialized for user ${username} (${userId})`);
    }
    
}

module.exports = Game;