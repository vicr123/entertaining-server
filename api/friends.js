const express = require('express');
const db = require('../db');
const winston = require('winston');
const play = require('../play/play');

let router = express.Router();
module.exports = router;

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
            results = await db.query(`SELECT requester.username FROM friendRequests, users AS requester WHERE friendRequests.requester = requester.id AND friendRequests.target=$1`, [
                req.authUser.userId
            ]);
            for (let row of results.rows) {
                friends.push({
                    username: row.username,
                    status: "request-incoming"
                });
            }
            
            results = await db.query(`SELECT target.username FROM friendRequests, users AS target WHERE friendRequests.target = target.id AND friendRequests.requester=$1`, [
                req.authUser.userId
            ]);
            for (let row of results.rows) {
                friends.push({
                    username: row.username,
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

router.post("/acceptByUsername", async (req, res) => {
    respondToFriendRequest(req, res, "accept");
});

router.post("/declineByUsername", async (req, res) => {
    respondToFriendRequest(req, res, "decline");
});

router.post("/retractByUsername", async (req, res) => {
    respondToFriendRequest(req, res, "retract");
});

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