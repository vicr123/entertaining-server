const EventEmitter = require('events');

class Tile extends EventEmitter {
    #tileNumber;
    #board;
    #numMinesAdj;
    state;
    isMine;
    
    constructor(tileNumber, board) {
        super();
        
        this.#tileNumber = tileNumber;
        this.#board = board;
        this.#numMinesAdj = null;
        this.state = Tile.States.idle;
        
        setImmediate(() => {
            this.emit("tileUpdate", this.tileUpdate());
        });
    }
    
    get minesAdjacent() {
        if (this.#numMinesAdj === null) {
            this.#numMinesAdj = 0;
            if (!this.isMine) {
                //Calculate number of mines adjacent
                for (let tile of this.#board.tilesAdjacent(this.#tileNumber)) {
                    if (this.#board.tile(tile).isMine) this.#numMinesAdj++;
                }
            }
        }
        return this.#numMinesAdj;
    }
    
    tileUpdate() {
        let updateObj = {
            type: "tileUpdate",
            tile: this.#tileNumber,
            state: this.state
        };
        
        if (this.state == Tile.States.revealed) {
            updateObj.isMine = this.isMine;
            updateObj.number = this.minesAdjacent;
        }
        
        return updateObj;
    }
    
    reveal() {
        if (this.state === Tile.States.idle) {
            this.state = Tile.States.revealed;
            this.emit("tileUpdate", this.tileUpdate());
            this.emit("tileRevealed");
            
            if (this.isMine) {
                this.emit("revealedMine");
            }
            
            if (this.minesAdjacent === 0) {
                //Reveal all the adjacent mines
                for (let tileNum of this.#board.tilesAdjacent(this.#tileNumber)) {
                    this.#board.tile(tileNum).reveal();
                }
            }
        }
    }
    
    flag() {
        if (this.state === Tile.States.idle) {
            this.state = Tile.States.flagged;
        } else if (this.state === Tile.States.flagged) {
            this.state = Tile.States.idle;
        }
        this.emit("tileUpdate", this.tileUpdate());
    }
    
    sweep() {
        if (this.state === Tile.States.revealed) {
            let numFlags = 0;
            let tilesToSweep = [];
            for (let tile of this.#board.tilesAdjacent(this.#tileNumber)) {
                let t = this.#board.tile(tile);
                if (t.state === Tile.States.flagged || (t.state === Tile.States.revealed && t.isMine)) {
                    numFlags++;
                } else {
                    tilesToSweep.push(t);
                }
            }
            
            console.log(this.minesAdjacent);
            console.log(numFlags);
            if (this.minesAdjacent === numFlags) {
                //Sweep the tile
                for (let tile of tilesToSweep) {
                    tile.reveal();
                }
            }
        }
    }
}

Tile.States = {
    idle: 0,
    revealed: 1,
    flagged: 2,
    marked: 3
}

module.exports = Tile;