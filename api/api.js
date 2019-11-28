const express = require('express');
const rateLimit = require('express-rate-limit');
const users = require('./users');
const friends = require('./friends');
const playRouter = require('./play');


let router = express.Router();
module.exports = router;

router.use(rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 1800,
    keyGenerator: function(req) {
        return req.clientIp
    }
}));

router.use("/users", users);
router.use("/friends", friends);

playRouter(router);

 /**
  * @apiDefine ERRUserUnknownTarget
  * @apiError user.unkownTarget The user was not found
  */
 
 /**
  * @apiDefine ERRUserNoPendingRequest
  * @apiError user.noPendingRequest There is no pending friend request from this user
  */
  
 /**
  * @apiDefine ERRUserNotFriends
  * @apiError user.notFriends The user is not friends with the other user
  */