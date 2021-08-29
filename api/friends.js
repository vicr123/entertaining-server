const express = require('express');
const db = require('../db');
const winston = require('winston');
const play = require('../play/play');
const accounts = require('../accounts-dbus');

let router = express.Router();
module.exports = router;

/**
 * @api . The Friends object
 * @apiName FriendsObject
 * @apiGroup Friends
 * @apiVersion 1.0.0
 * 
 * @apiDescription The Friends object contains the following members:<br /><br />
 *
 * | Name | Description |
 * |---|---|
 * |username|The username of the user|
 * |status|The status of the user|
 * |onlineState|Whether the player is online or not|
 */

/**
 * @api {get} /friends Get current user's friends
 * @apiName GetFriends
 * @apiGroup Friends
 * @apiVersion 1.0.0
 * @apiSampleRequest /friends
 *
 * @apiSuccess {Friends[]} friends List of friends.
 */
router.get("/", async (req, res) => {
    if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            let friends = [];
            let results;
            
            //Return all friends
            results = await db.friendsForUserId(req.authUser.userId);
            for (let r of results) {
                friends.push({
                    username: r.username,
                    status: "friend",
                    onlineState: play.onlineState(r.userId)
                });
            }
            
            //Get all the requests
            results = await db.query(`SELECT requester FROM friendRequests WHERE friendRequests.target=$1`, [
                req.authUser.userId
            ]);
            for (let row of results.rows) {
                let path = await accounts.manager().UserById(row.requester);
                let userPath = await accounts.path(path);
                let userProperties = userPath.getInterface("org.freedesktop.DBus.Properties");
                let username = (await userProperties.Get("com.vicr123.accounts.User", "Username")).value;

                friends.push({
                    username: username,
                    status: "request-incoming"
                });
            }
            
            results = await db.query(`SELECT target FROM friendRequests WHERE friendRequests.requester=$1`, [
                req.authUser.userId
            ]);
            for (let row of results.rows) {
                let path = await accounts.manager().UserById(row.target);
                let userPath = await accounts.path(path);
                let userProperties = userPath.getInterface("org.freedesktop.DBus.Properties");
                let username = (await userProperties.Get("com.vicr123.accounts.User", "Username")).value;

                friends.push({
                    username: username,
                    status: "request-outgoing"
                });
            }
            
            res.status(200).send(friends);
        } catch (error) {
            //Internal Server Error
            winston.log("error", error.message);
            res.status(500).send();
        }
    }
});

/**
 * @api {post} /friends/requestByUsername Send a friend request by username
 * @apiName FriendRequestByUsername
 * @apiGroup Friends
 * @apiVersion 1.0.0
 * @apiSampleRequest /friends/requestByUsername
 *
 * @apiParam {String} username    Username of the user to request friends with.
 * 
 * @apiUse ERRUserUnknownTarget
 */
router.post("/requestByUsername", async (req, res) => {
    if (!req.body.username) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            //Get the user that we want to be made friends with
            let result = await db.userForUsername(req.body.username);
            if (!result) {
                //This user does not exist
                res.status(400).send({
                    "error": "user.unknownTarget"
                });
                return;
            }
            
            let targetId = result.userId;
            
            //Make sure we're not already friends
            result = await db.query(`SELECT * FROM friends WHERE (friends.firstUser=$1 AND friends.secondUser=$2) OR (friends.firstUser=$2 AND friends.secondUser=$1)`, [
                req.authUser.userId, targetId
            ]);
            if (result.rowCount != 0) {
                //These users are already friends
                res.status(400).send({
                    "error": "friends.alreadyFriends"
                });
                return;
            }
            
            //Add into friend requests
            await db.query(`INSERT INTO friendrequests(requester, target) VALUES($1, $2)`, [
                req.authUser.userId, targetId
            ]);
            
            play.beam(targetId, {
                system: true,
                type: "newFriendRequest",
                user: req.authUser.username
            });
            
            res.status(204).send();
        } catch (error) {
            //Internal Server Error
            winston.log("error", error.message);
            res.status(500).send();
        }
    }
});


let respondToFriendRequest = async (req, res, accept) => {
    if (!req.body.username) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            //Get the user that we want to be made friends with
            let result = await db.userForUsername(req.body.username);
            if (!result) {
                //This user does not exist
                res.status(400).send({
                    "error": "user.unknownTarget"
                });
                return;
            }
            
            let requesterId;
            let targetId;
            if (accept == "retract") {
                //This is a retraction, so act as if the target declined
                requesterId = req.authUser.userId;
                targetId = result.userId;
            } else {
                requesterId = result.userId;
                targetId = req.authUser.userId;
            }
            
            //Check if we've got an active request
            result = await db.query(`SELECT * FROM friendRequests WHERE requester=$1 AND target=$2`, [
                requesterId, targetId
            ]);
            if (result.rowCount == 0) {
                //There is no pending request
                res.status(400).send({
                    "error": "friends.noPendingRequest"
                });
                return;
            }
            
            //Remove from friend requests
            await db.query(`DELETE FROM friendRequests WHERE requester=$1 AND target=$2`, [
                requesterId, targetId
            ]);
            
            if (accept == "accept") {
                //Make friends if we're accepting this request
                await db.query(`INSERT INTO friends(firstUser, secondUser) VALUES($1, $2)`, [
                    requesterId, targetId
                ]);
                
                play.beam(requesterId, {
                    system: true,
                    type: "friendRequestAccepted",
                    user: req.authUser.username
                });
            }
            
            res.status(204).send();
        } catch (error) {
            //Internal Server Error
            winston.log("error", error.message);
            res.status(500).send();
        }
    }
}

/**
 * @api {post} /friends/acceptByUsername Accept a friend request by username
 * @apiName AcceptFriendRequestByUsername
 * @apiGroup Friends
 * @apiVersion 1.0.0
 * @apiSampleRequest /friends/acceptByUsername
 *
 * @apiParam {String} username    Username of the user to respond to.
 * 
 * @apiUse ERRUserUnknownTarget
 * @apiUse ERRUserNoPendingRequest
 */
router.post("/acceptByUsername", async (req, res) => {
    respondToFriendRequest(req, res, "accept");
});

/**
 * @api {post} /friends/declineByUsername Decline a friend request by username
 * @apiName DeclineFriendRequestByUsername
 * @apiGroup Friends
 * @apiVersion 1.0.0
 * @apiSampleRequest /friends/declineByUsername
 *
 * @apiParam {String} username    Username of the user to respond to.
 * 
 * @apiUse ERRUserUnknownTarget
 * @apiUse ERRUserNoPendingRequest
 */
router.post("/declineByUsername", async (req, res) => {
    respondToFriendRequest(req, res, "decline");
});

/**
 * @api {post} /friends/retractByUsername Retract a sent friend request by username
 * @apiName RetractFriendRequestByUsername
 * @apiGroup Friends
 * @apiVersion 1.0.0
 * @apiSampleRequest /friends/retractByUsername
 *
 * @apiParam {String} username    Username of the user to retract the friend request from.
 * 
 * @apiUse ERRUserUnknownTarget
 * @apiUse ERRUserNoPendingRequest
 */
router.post("/retractByUsername", async (req, res) => {
    respondToFriendRequest(req, res, "retract");
});

/**
 * @api {post} /friends/removeByUsernme Remove a friend
 * @apiName RemoveFriendByUsername
 * @apiGroup Friends
 * @apiVersion 1.0.0
 * @apiSampleRequest /friends/removeByUsername
 *
 * @apiParam {String} username    Username of the user to remove friends.
 * 
 * @apiUse ERRUserUnknownTarget
 * @apiUse ERRUserNotFriends
 */
router.post("/removeByUsername", async (req, res) => {
    if (!req.body.username) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            //Get the user to remove
            let result = await db.userForUsername(req.body.username);
            if (!result) {
                //This user does not exist
                res.status(400).send({
                    "error": "user.unknownTarget"
                });
                return;
            }
            
            //Check if there exists a friend relation
            let targetId = result.userId;
            result = await db.query(`SELECT * FROM friends WHERE (firstUser=$1 AND secondUser=$2) OR (firstUser=$2 AND secondUser=$1)`, [
                req.authUser.userId, targetId
            ]);
            if (result.rowCount == 0) {
                //There is no pending request
                res.status(400).send({
                    "error": "friends.notFriends"
                });
                return;
            }
            
            //Remove the friend relation
            await db.query(`DELETE FROM friends WHERE (firstUser=$1 AND secondUser=$2) OR (firstUser=$2 AND secondUser=$1)`, [
                req.authUser.userId, targetId
            ]);
            
            res.status(204).send();
        } catch (error) {
            //Internal Server Error
            winston.log("error", error.message);
            res.status(500).send();
        } 
    }
});