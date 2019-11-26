const play = require('../play/play');
const db = require('../db');

/**
 * @api {get} /play Play a game
 * @apiName PlayGame
 * @apiGroup Play
 * @apiVersion 1.0.0
 * 
 * @apiDescription This endpoint expects a WebSockets handshake.
 * 
 * For more information about playing games, please see "Starting a game session"
 */

function handleWs(ws, req) {
    play.play(ws);
}

/**
 * @api . Starting a game session
 * @apiName StartingGameSession
 * @apiGroup Play
 * @apiVersion 1.0.0
 * 
 * @apiDescription To start a game session, make a call to `/api/play`. For more information about the API call, see the documentation for "Play a game".
 *
 * <br />
 * 
 * After initiating the WebSockets connection, the server expects a JSON object to be sent to tell the server which game is currently being played.
 */
 
module.exports = function(parentRouter) {
    parentRouter.ws("/play", handleWs);
}