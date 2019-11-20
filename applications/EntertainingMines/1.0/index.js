const winston = require('winston');
const Room = require('./room');
const crypto = require('crypto');
const db = require('../../../db.js');

const States = {
    idle: 0,
    lobby: 1,
    game: 2
}

function colourFromUserId(userId) {
    // Algorithm for converting between HSV taken from Wikipedia:
    // https://en.wikipedia.org/wiki/HSL_and_HSV#HSV_to_RGB
    
    let h = userId % 360;
    let s = 1;
    let v = 0.5;
    
    let c = v * s;
    let hPr = h / 60;
    let x = c * (1 - Math.abs(hPr % 2 - 1));
    
    let rgb1;
    if (hPr <= 1) {
        rgb1 = [c, x, 0];
    } else if (hPr <= 2) {
        rgb1 = [x, c, 0];
    } else if (hPr <= 3) {
        rgb1 = [0, c, x];
    } else if (hPr <= 4) {
        rgb1 = [0, x, c];
    } else if (hPr <= 5) {
        rgb1 = [x, 0, c];
    } else {
        rgb1 = [c, 0, x];
    }
    
    let m = v - c;
    let rgb = rgb1.map(y => {
        return Math.round((y + m) * 255);
    });
    console.log(rgb);
    
    let colBuf = Buffer.allocUnsafe(4);
    colBuf.writeUInt8(0xFF);
    Buffer.from(rgb).copy(colBuf, 1);
    
    
    return colBuf.readUInt32BE(0);
}

class Game {
    #ws;
    #username;
    #userId;
    #sessionId;
    #picture;
    #state;
    #room;
    #colour;
    
    constructor(ws, username, userId) {
        this.#ws = ws;
        this.#username = username;
        this.#userId = userId;
        this.#state = States.idle;
        this.#room = null;
        this.#sessionId = Math.floor(Math.random() * 1000000);
        
//         let colBuf = Buffer.allocUnsafe(4);
//         colBuf.writeUInt8(0xFF);
//         crypto.randomBytes(3).copy(colBuf, 1);
//         this.#colour = colBuf.readUInt32BE(0);
        
        //Generate a colour based on the user ID of this user
        this.#colour = colourFromUserId(userId);
                
        db.userForUsername(username).then(info => {
            this.#picture = info.gravHash;
        });
        
        ws.on("close", (code, reason) => {
            winston.log('silly', `Entertaining Mines client closed with close code ${code}`);
        });
        ws.on("jsonMessage", this.handleMessage.bind(this));
        
        winston.log('verbose', `Entertaining Mines client initialized for user ${username} (${userId})`);
        
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
        
        console.log(message);
        console.log(message.type);
        const handlers = {
            "createRoom": this.createAndJoinRoom.bind(this),
            "joinRoom": this.joinRoom.bind(this),
            "leaveRoom": this.leaveRoom.bind(this),
            "availableRooms": this.getAvailableRooms.bind(this)
        };
        if (handlers.hasOwnProperty(message.type)) {
            handlers[message.type](message);
        } else if (this.#room) {
            this.#room.processMessage(this, message);
        }
    }
    
    createAndJoinRoom() {
        if (this.#state != States.idle) {
            //Drop the connection because this is a protocol error
            this.#ws.close(1002);
        } else {
            let room = new Room();
            this.joinRoom({
                "roomId": room.id
            });
        }
    }
    
    joinRoom(message) {
        if (this.#state != States.idle) {
            //Drop the connection because this is a protocol error
            this.#ws.close(1002);
        } else {
            let room = Room.roomById(message.roomId);
            if (!room) {
                this.#ws.sendObject({
                    type: "joinRoomFailed",
                    reason: "room.invalid"
                });
                return;
            }
            
            let addUserResponse = room.addUser(this);
            if (addUserResponse !== "ok") {
                this.#ws.sendObject({
                    type: "joinRoomFailed",
                    reason: addUserResponse
                });
                return;
            }
            this.#room = room;
            
            this.changeState("lobby");
        }
    }
    
    leaveRoom() {
        if (this.#state != States.lobby && this.#state != States.game) {
            //Drop the connection because this is a protocol error
            this.#ws.close(1002);
        } else {
            this.#room.removeUser(this);
            this.#room = null;
            
            this.changeState("idle");
        }
    }
    
    changeState(state) {
        this.#ws.sendObject({
            type: "stateChange",
            newState: state
        });
        this.#state = States[state];
    }
    
    async getAvailableRooms() {
        //Get all the friends
        let rooms = [];
        
        let friends = await db.friendsForUserId(this.#userId);
        for (let friend of friends) {
            let rs = Room.roomsByUserId(friend.userId);
            for (let room of rs) {
                room.friendName = friend.username;
                rooms.push(room);
            }
        }
        
        this.#ws.sendObject({
            type: "availableRoomsReply",
            rooms: rooms.map(room => {
                return {
                    friend: room.friendName,
                    roomId: room.id,
                    pinRequired: room.pinRequired
                };
            })
        });
    }
    
    static displayName() {
        return "Entertaining Mines";
    }
    
    get username() {
        return this.#username;
    }
    
    get userId() {
        return this.#userId;
    }
    
    get ws() {
        return this.#ws;
    }
    
    get picture() {
        return this.#picture;
    }
    
    get colour() {
        return this.#colour;
    }
    
    get sessionId() {
        return this.#sessionId;
    }
}

module.exports = Game;