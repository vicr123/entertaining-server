const winston = require('winston');
const Matchmaking = require("./matchmaking");
const db = require('../../../db.js');

const States = {
    idle: 0,
    matchmaking: 1,
    game: 2
}

class Game {
    #ws;
    #username;
    #userid;
    #picture;
    #sessionId;
    #state;
    #matchmakingCode;

    #matchPeer;
    #isMatchHost;

    constructor(ws, username, userId) {
        this.#ws = ws;
        this.#username = username;
        this.#userid = userId;
        this.#sessionId = Math.floor(Math.random() * 1000000);
        this.#state = States.idle;

        db.userForUsername(username).then(info => {
            this.#picture = info.gravHash;
        });

        ws.on("close", (code, reason) => {
            winston.log('silly', `Entertaining Chess client closed with close code ${code}`);
        });
        ws.on("jsonMessage", this.handleMessage.bind(this));

        winston.log('verbose', `Entertaining Chess client initialized for user ${username} (${userId})`);

        setTimeout(() => {
            this.#ws.sendObject({
                type: "sessionIdChanged",
                session: this.#sessionId
            });
        }, 1000);
    }

    async handleMessage(message) {
        //Don't handle system messages
        if (message.system) return;

        const handlers = {
            "launchPrivate": this.launchPrivate.bind(this),
            "cancelMatchmaking": this.cancelMatchmaking.bind(this),
            "joinPrivate": this.joinPrivate.bind(this),
            "disconnectPeer": this.disconnectPeer.bind(this)
        };
        if (handlers.hasOwnProperty(message.type)) {
            handlers[message.type](message);
        } else if (this.#matchPeer) {
            this.#matchPeer.peerMessage(message);
        }
    }

    static displayName() {
        return "Entertaining Chess";
    }

    launchPrivate(message) {
        if (this.#state != States.idle) {
            //Drop the connection because this is a protocol error
            this.#ws.close(1002);
        } else {
            this.#matchmakingCode = Matchmaking.startMatchmakingPrivate(this);
            this.#state = States.matchmaking;
            this.#isMatchHost = true;
            this.#ws.sendObject({
                type: "matchmakingStarted",
                code: this.#matchmakingCode,
                playerIsWhite: message.playerIsWhite
            });
        }
    }

    joinPrivate(message) {
        if (this.#state != States.idle) {
            //Drop the connection because this is a protocol error
            this.#ws.close(1002);
        } else {
            let otherGame = Matchmaking.takeMatch(message.code);
            if (!otherGame) {
                this.#ws.sendObject({
                    type: "peerConnectionError"
                });
            } else {
                otherGame.linkGames(this);
                this.linkGames(otherGame);
                this.#isMatchHost = false;
            }
        }
    }

    cancelMatchmaking(message) {
        if (this.#matchPeer) this.disconnectPeer(message);

        this.#state = States.idle;
        Matchmaking.takeMatch(this.#matchmakingCode);
        this.#ws.sendObject({
            type: "matchmakingCancelled"
        });
    }

    disconnectPeer(message) {
        this.#matchPeer.#matchPeer = null;
        this.#matchPeer.#state = States.idle;
        this.#matchPeer.#ws.sendObject({
            type: "peerDisconnected"
        });

        this.#matchPeer = null;
        this.#state = States.idle;
        this.#ws.sendObject({
            type: "peerDisconnected"
        });
    }

    linkGames(otherGame) {
        this.#matchPeer = otherGame;
        this.#ws.sendObject({
            type: "peerConnected",
            username: otherGame.#username,
            picture: otherGame.#picture
        });
        this.#ws.on('close', () => {
            if (this.#matchPeer == otherGame) this.disconnectPeer();
        });
    }

    peerMessage(message) {
        this.#ws.sendObject(message);
    }
}

module.exports = Game;