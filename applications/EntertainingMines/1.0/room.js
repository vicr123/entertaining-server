const winston = require('winston');

const coop = require('./coop');
const tbCoop = require('./tbcoop');

let rooms = {};

class Room {
    #id;
    #users;
    #gamemode;
    #playing;
    #maxUsers;
    
    #boardParams;
    #board;
    
    constructor() {
        this.#id = Room.generateId();
        this.#users = [];
        this.#gamemode = "cooperative";
        this.#playing = false;
        this.#boardParams = {
            width: 9,
            height: 9,
            mines: 10
        };
        this.#maxUsers = 10;
        rooms[this.#id] = this;
        
        winston.log("verbose", `Entertaining Mines room #${this.#id} created`);
    }
    
    static generateId() {
        return Math.floor(Math.random() * 10000000 + 1000000);
    }
    
    static roomById(id) {
        return rooms[id];
    }
    
    static roomsByUserId(userId) {
        //Find all the rooms where this user is a member
        let rs = Object.values(rooms).filter(room => {
            for (let user of room.users) {
                if (user.userId === userId) return true;
            }
            return false;
        });
        
        return rs;
    }
    
    processMessage(user, message) {
        if (this.isHost(user)) {
            const handlers = {
                "changeGamemode": this.changeGamemode.bind(this),
                "changeBoardParams": this.changeBoardParams.bind(this),
                "startGame": this.startGame.bind(this)
            };
            
            if (handlers.hasOwnProperty(message.type)) {
                handlers[message.type](user, message);
            }
        }
        
        const handlers = {
            "boardAction": this.boardAction.bind(this),
            "currentTileChanged": this.currentTileChanged.bind(this),
            "sendMessage": this.sendCannedMessage.bind(this)
        };
        if (handlers.hasOwnProperty(message.type)) {
            handlers[message.type](user, message);
        }
    }
    
    addUser(user) {
        if (this.#playing) {
            return "room.closed";
        }
        if (this.#users.count >= this.#maxUsers) {
            return "room.full";
        }
        
        this.#users.push(user);
        
        user.ws.on("close", () => {
            this.removeUser(user);
        });
        
        user.ws.sendObject({
            type: "lobbyChange",
            lobbyId: this.#id
        });
        this.beamRoomUpdate();
        
        return "ok";
    }
    
    removeUser(user) {
        if (this.#users.includes(user)) {
            this.#users.splice(this.#users.indexOf(user), 1);
            
            if (this.#playing) {
                this.#board.removeUser(user);
            }
            
            user.ws.sendObject({
                type: "lobbyChange",
                lobbyId: -1
            });
            
            if (this.#users.length == 0) {
                //Close this room
                delete rooms[this.#id];
                winston.log("verbose", `Entertaining Mines room #${this.#id} closed`);
            } else {
                this.beamRoomUpdate();
            }
        }
    }
    
    beamRoomUpdate() {
        let users = [];
        
        for (let user of this.#users) {
            users.push({
                session: user.sessionId,
                username: user.username,
                picture: user.picture,
                colour: user.colour,
                isHost: this.isHost(user)
            });
        }
        
        let message = {
            type: "roomUpdate",
            users: users,
            maxUsers: this.#maxUsers
        };
        
        this.beam(message);
        this.changeGamemode(null, {
            gamemode: this.#gamemode
        });
        this.changeBoardParams(null, this.#boardParams);
        
        for (let user of this.#users) {
            if (this.isHost(user)) {
                user.ws.sendObject({
                    type: "hostUpdate",
                    isHost: true
                });
            } else {
                user.ws.sendObject({
                    type: "hostUpdate",
                    isHost: false
                });
            }
        }
    }
    
    beam(message) {
        for (let user of this.#users) {
            this.sendMessage(user, message);
        }
    }
    
    sendMessage(user, message) {
        user.ws.sendObject(message);
    }
    
    sendCannedMessage(user, message) {
        this.beam({
            type: "cannedMessage",
            user: user.sessionId,
            username: user.username,
            message: message.message
        });
    }
    
    changeGamemode(user, message) {
        if (message.gamemode !== "cooperative" && message.gamemode !== "competitive" && message.gamemode !== "tb-cooperative") return;
        
        this.#gamemode = message.gamemode;
        if (this.#gamemode === "competitive") this.#gamemode = "cooperative";
        this.beam({
            type: "gamemodeChange",
            gamemode: this.#gamemode
        });
    }
    
    changeBoardParams(user, message) {
        let width = message.width;
        let height = message.height;
        let mines = message.mines;
        
        if (width < 5) width = 5;
        if (width > 50) width = 50;
        if (height < 5) height = 5;
        if (height > 50) height = 50;
        
        let minesMax = Math.floor(width * height * 0.9) - 9;
        if (mines < 1) mines = 1;
        if (mines > minesMax) mines = minesMax;
        
        this.#boardParams = {
            width: width,
            height: height,
            mines: mines
        };
        
        this.beam({
            type: "boardParamsChange",
            width: width,
            height: height,
            mines: mines
        });
    };
    
    startGame(user, message) {
        //Start the game!
        this.#playing = true;
        
        if (this.#gamemode === "cooperative") {
            this.#board = new coop(this.#boardParams, this);
        } else if (this.#gamemode === "tb-cooperative") {
            this.#board = new tbCoop(this.#boardParams, this);
        } else {
            return;
        }
        
        this.beam({
            type: "boardSetup",
            width: this.#boardParams.width,
            height: this.#boardParams.height,
            mines: this.#boardParams.mines
        });
        
        for (let user of this.#users) {
            user.changeState("game");
        }
    }
    
    currentTileChanged(user, message) {
        if (this.#playing) {
            this.#board.currentTileChanged(user, message);
        }
    }
    
    endGame() {
        for (let user of this.#users) {
            user.changeState("lobby");
        }
        
        this.beamRoomUpdate();
        this.#playing = false;
    }
    
    boardAction(user, message) {
        this.#board.boardAction(user, message);
    }
    
    isHost(user) {
        return this.#users[0] === user;
    }
    
    get id() {
        return this.#id;
    }
    
    get users() {
        return this.#users;
    }
    
    get pinRequired() {
        return false;
    }
}

module.exports = Room;