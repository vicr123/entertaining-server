const winston = require('winston');

let rooms = {};

class Room {
    #id;
    #users;
    
    constructor() {
        this.#id = Room.generateId();
        this.#users = [];
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
    
    addUser(user) {
        this.#users.push(user);
        
        user.ws.on("close", () => {
            this.removeUser(user);
        });
        
        user.ws.sendObject({
            type: "lobbyChange",
            lobbyId: this.#id
        });
        this.beamRoomUpdate();
    }
    
    removeUser(user) {
        if (this.#users.includes(user)) {
            this.#users.splice(this.#users.indexOf(user), 1);
            
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
            users.push(user.username);
        }
        
        let message = {
            type: "roomUpdate",
            users: users,
            maxUsers: 4
        };
        
        for (let user of this.#users) {
            user.ws.sendObject(message);
        }
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