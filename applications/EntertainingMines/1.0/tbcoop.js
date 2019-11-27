const Tile = require('./tile');
const CoopBoard = require('./coop');
const winston = require('winston');

class TbCoopBoard extends CoopBoard {
    #currentUserIndex;
    #currentUserSession;
    #timeout;
    
    constructor(params, room) {
        super(params, room);
        this.#currentUserIndex = -1;
        
        setImmediate(() => {
            //Choose a random player to start
            this.#currentUserIndex = Math.floor(Math.random() * this.room.users.length);
            this.nextUser();
        });
    }
    
    removeUser(user) {
        super.removeUser(user);

        //Keep the index up to date
        for (let i = 0; i < this.room.users.length; i++) {
            if (user.sessionId === this.#currentUserSession) {
                this.#currentUserIndex = i;
                return;
            }
        }
        
        //If we get here it means the current user has left :(
        this.#currentUserIndex--;
        this.nextUser();
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
    
    currentTileChanged(user, message) {
        if (message.tile < 0 || message.tile >= this.tiles.length) return;
        
        this.currentTiles[user.sessionId] = message.tile;
        if (this.#currentUserSession === user.sessionId) this.beamCurrentTile();
    }
    
    beamCurrentTile() {
        let currentTiles = [];
        
        let tileDescriptor = this.currentTiles[this.#currentUserSession];
        if (tileDescriptor) {
            let user = this.currentUser;
            currentTiles.push({
                tile: tileDescriptor,
                user: user.sessionId,
                colour: user.colour
            });
        }
        
        //Tell everyone about the current tiles
        this.room.beam({
            "type": "currentTilesChanged",
            "tiles": currentTiles
        });
    }
    
    nextUser() {
        if (this.gameIsOver) return; //Do nothing because the game is over
        if (this.room.users.length === 0) return; //Bail out because everyone's gone :(
        
        this.#currentUserIndex++;
        if (this.#currentUserIndex >= this.room.users.length) this.#currentUserIndex = 0;
        
        this.#currentUserSession = this.currentUser.sessionId;
        
        clearTimeout(this.#timeout);
        this.#timeout = setTimeout(this.nextUser.bind(this), 30000);
        
        this.room.beam({
            type: "currentPlayerChange",
            session: this.currentUser.sessionId,
            timeout: Date.now() + 30000
        });
        
        this.beamCurrentTile();
    }
    
    get currentUser() {
        return this.room.users[this.#currentUserIndex];
    }
}

module.exports = TbCoopBoard;