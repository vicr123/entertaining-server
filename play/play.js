const fs = require('fs');
const db = require('../db');
const winston = require('winston');

const ApplicationWebSocketsErrors = {
    AuthenticationError: 4000,
    UnknownApplication: 4001,
    BadVersion: 4002
}

let openSockets = [];

class Play {
    #ws;
    #userId;
    #openSocket;
    
    constructor(ws) {
        this.#ws = ws;
        this.#openSocket = null;
        winston.log('silly', `Entertaining Games client created`);
        
        ws.once('message', async (message) => {
            //This should be the handshake message
            //If not, close the connection immediately.
            let object = JSON.parse(message);
            
            if (!object.token || !object.application || !object.version) {
                winston.log('silly', `Entertaining Games client tried to connect with missing fields`);
                ws.close(1002); //Protocol Error
                return;
            }
            
            //Check the token
            let row = await db.userForToken(object.token);
            if (!row) {
                //Invalid Token
                winston.log('verbose', `Entertaining Games client tried to connect with incorrect credentials`);
                ws.close(ApplicationWebSocketsErrors.AuthenticationError);
                return;
            }
            let username = row.username;
            let userId = row.userId;
            
            this.#userId = userId;
            this.#openSocket = {
                userId: userId,
                socket: this
            };
            openSockets.push(this.#openSocket);
            
            winston.log('silly', `Entertaining Games client requested for user ${username} (${userId})`);
            
            //Initialize the application
            if (!/^[A-Za-z0-9.]+$/.test(object.application) || !/^[A-Za-z0-9.]+$/.test(object.version)) {
                //We may have dangerous input, so close the connection because the application does not exist
                winston.log('verbose', `Entertaining Games client for user ${username} (${userId}) tried to connect with a dangerous application name`);
                ws.close(ApplicationWebSocketsErrors.UnknownApplication);
                return;
            }
            
            let applicationDir = `./applications/${object.application}/`;
            let applicationVersionDir = `./applications/${object.application}/${object.version}/`;
            
            if (!fs.existsSync(applicationDir)) {
                //Invalid Application
                winston.log('silly', `Entertaining Games client for user ${username} (${userId}) tried to connect with application ${object.application} which does not exist`);
                ws.close(ApplicationWebSocketsErrors.UnknownApplication);
                return;
            }
            
            if (!fs.existsSync(applicationVersionDir)) {
                //Invalid Application Version
                winston.log('silly', `Entertaining Games client for user ${username} (${userId}) tried to connect with application ${object.application}, version ${object.version} which does not exist`);
                ws.close(ApplicationWebSocketsErrors.BadVersion);
                return;
            }
            
            this.sendObject({
                status: "OK",
                upgrade: object.application,
                playingAs: username
            });
            
            winston.log('silly', `Handing control of Entertaining Games client for user ${username} (${userId}) over to the requested application (${object.application}@${object.version})`);
            
            //Start and hand over the websocket to this application
            let App = require(`.${applicationVersionDir}/index.js`);
            new App(ws, username, userId);
            
            //Send any interesting events over
            this.sendEvents();
        });
        
        ws.on("message", (message) => {
            let object = JSON.parse(message);
            if (object.system === true) {
                if (object.type == "clientPing") {
                    //Immediately send back a ping
                    this.sendObject({
                        system: true,
                        type: "clientPingReply",
                        seq: object.seq
                    });
                }
            }
        });
        
        ws.on("close", (closeCode) => {
            if (this.#openSocket) {
                openSockets.splice(openSockets.indexOf(this.#openSocket, 1));
            }
        });
        
        process.on("SIGINT", () => {
            ws.close(1001); //Going Away
        });
        process.on("SIGTERM", () => {
            ws.close(1001); //Going Away
        });
    }
    
    sendObject(object) {
        this.#ws.send(JSON.stringify(object));
    }
    
    async sendEvents() {
        //Check for any friend requests
        let results = await db.query(`SELECT * FROM friendRequests WHERE target=$1`, [
            this.#userId
        ]);
        
        if (results.rowCount > 0) {
            //Send a notification over
            this.sendObject({
                system: true,
                type: "notifyNewFriendRequests"
            });
        }
    }
    
    static async beam(userId, object) {
        for (let socket of openSockets) {
            if (socket.userId === userId) {
                socket.socket.sendObject(object);
            }
        }
    }
}

module.exports = {
    play: function(ws) {
        new Play(ws);
    },
    beam: Play.beam
};