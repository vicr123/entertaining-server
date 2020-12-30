class Matchmaking {
    #matches;

    constructor() {
        this.#matches = {};
    }

    startMatchmakingPrivate(game) {
        let code = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        while (this.#matches.hasOwnProperty(code)) {
            code = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        }
        this.#matches[code] = game;
        return code;
    }

    takeMatch(code) {
        if (this.#matches.hasOwnProperty(code)) {
            let game = this.#matches[code];
            delete this.#matches[code];
            return game;
        } else {
            return null;
        }
    }
}

let m = new Matchmaking();

module.exports = m;