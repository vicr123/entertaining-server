const express = require('express');
const play = require('../play/play');
const users = require('./users');
const friends = require('./friends');

let router = express.Router();
module.exports = router;

router.use("/users", users);
router.use("/friends", friends);

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
router.ws("/play", function(ws, req) {
    play.play(ws);
});


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
 
 /**
  * @apiDefine ERRUserUnknownTarget
  * @apiError user.unkownTarget The user was not found
  */