const express = require('express');
const users = require('./users');
const friends = require('./friends');
const playRouter = require('./play');

let router = express.Router();
module.exports = router;

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