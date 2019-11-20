const Tile = require('./tile');
const CoopBoard = require('./coop');
const winston = require('winston');

class TbCoopBoard extends CoopBoard {
    #currentUserIndex;
    #currentUserSession;
    
    constructor(params, room) {
        super(params, room);
        this.#currentUserIndex = -1;
        
        setImmediate(() => {
            this.nextUser();
        });
    }
    
    removeUser(user) {
        super.removeUser(user);

        if (this.#currentUserSession == user.sessionId) this.nextUser();
    }
    
    boardAction(user, message) {
        if (user !== this.currentUser) return false;
        
        if (message.action === "skip") {
            //Skip to the next player
            this.nextUser();
        } else {
            let actionTaken = super.boardAction(user, message);
            
            if (actionTaken && (message.action === "reveal" || message.action === "sweep")) {
                this.nextUser();
            }
        }
    }
    
    nextUser() {
        this.#currentUserIndex++;
        if (this.#currentUserIndex >= this.room.users.length) this.#currentUserIndex = 0;
        
        this.#currentUserSession = this.currentUser.sessionId;
        
        this.room.beam({
            type: "currentPlayerChange",
            session: this.currentUser.sessionId
        });
    }
    
    get currentUser() {
        return this.room.users[this.#currentUserIndex];
    }
}

module.exports = TbCoopBoard;