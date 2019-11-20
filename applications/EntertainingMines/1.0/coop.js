const Tile = require('./tile');

class CoopBoard {
    #boardSquares;
    #params;
    #minesRemaining;
    
    tiles;
    room;
    
    #gameIsOver;
    
    constructor(params, room) {
        this.tiles = [];
        this.#params = params;
        this.room = room;
        this.#gameIsOver = false;
        this.#minesRemaining = params.mines;
        
        for (let y = 0; y < params.height; y++) {
            for (let x = 0; x < params.width; x++) {
                let t = new Tile(y * params.width + x, this);
                t.on("tileUpdate", tile => {
                    room.beam(tile);
                });
                t.on("revealedMine", this.revealedMine.bind(this));
                t.on("tileRevealed", this.tileRevealed.bind(this));
                this.tiles.push(t);
            }
        }
        
        for (let i = 0; i < params.mines; i++) {
            let t = this.tiles[Math.floor(Math.random() * this.tiles.length)]
            if (t.isMine) {
                i--;
            } else {
                t.isMine = true;
            }
        }
    }
    
    boardAction(user, message) {
        if (this.#gameIsOver) return false;
        
        let t = this.tiles[message.tile];
        if (message.action === "reveal") {
            return t.reveal(user);
        } else if (message.action === "flag") {
            return t.flag();
        } else if (message.action === "sweep") {
            return t.sweep(user);
        }
    }
    
    tilesAdjacent(tileNum) {
        let tiles = [];
        
        let thisPoint = [Math.floor(tileNum % this.#params.width), Math.floor(tileNum / this.#params.width)];
        let checkAndAddPoint = (dx, dy) => {
            let x = thisPoint[0] + dx;
            let y = thisPoint[1] + dy;
            if (x >= 0 && x < this.#params.width && y >= 0 && y < this.#params.height) tiles.push(y * this.#params.width + x);
        }
        
        checkAndAddPoint(-1, -1);
        checkAndAddPoint(-1, 0);
        checkAndAddPoint(-1, 1);
        checkAndAddPoint(0, 1);
        checkAndAddPoint(1, 1);
        checkAndAddPoint(1, 0);
        checkAndAddPoint(1, -1);
        checkAndAddPoint(0, -1);
        
        return tiles;
    }
    
    tile(tileNumber) {
        return this.tiles[tileNumber];
    }
    
    revealedMine(user) {
        this.#gameIsOver = true;
        for (let tile of this.tiles) {
            tile.sendTileUpdate();
        }
        
        this.room.beam({
            "type": "endGame",
            "victory": false,
            "user": user.username,
            "picture": user.picture
        });
        
        setTimeout(() => {
            this.room.endGame();
        }, 5000);
    }
    
    tileRevealed() {
        for (let tile of this.tiles) {
            if (tile.state !== Tile.States.revealed && !tile.isMine) {
                return;
            }
        }
        
        this.#gameIsOver = true;
        this.room.beam({
            "type": "endGame",
            "victory": true
        });
        
        setTimeout(() => {
            this.room.endGame();
        }, 5000);
    }
    
    changeMinesRemaining(increment) {
        this.#minesRemaining += (increment ? 1 : -1);
        this.room.beam({
            "type": "minesRemainingChanged",
            "minesRemaining": this.#minesRemaining
        });
    }
    
    removeUser(user) {
        //noop
    }
    
    get gameIsOver() {
        return this.#gameIsOver;
    }
}

module.exports = CoopBoard;