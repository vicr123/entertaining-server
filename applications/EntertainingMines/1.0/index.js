const winston = require('winston');
const Room = require('./room');
const db = require('../../../db.js');

const States = {
    idle: 0,
    lobby: 1,
    game: 2
}

class Game {
    #ws;
    #username;
    #userId;
    #state;
    #room;
    
    constructor(ws, username, userId) {
        this.#ws = ws;
        this.#username = username;
        this.#userId = userId;
        this.#state = States.idle;
        this.#room = null;
        
        ws.on("close", (code, reason) => {
            winston.log('silly', `Entertaining Mines client closed with close code ${code}`);
        });
        ws.on("jsonMessage", this.handleMessage.bind(this));
        
        winston.log('verbose', `Entertaining Mines client initialized for user ${username} (${userId})`);
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
            
            room.addUser(this);
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
}

module.exports = Game;