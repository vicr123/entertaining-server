const express = require('express');
const play = require('../play/play');
const users = require('./users');
const friends = require('./friends');

let router = express.Router();
module.exports = router;

router.use("/users", users);
router.use("/friends", friends);

router.ws("/play", function(ws, req) {
    play.play(ws);
});