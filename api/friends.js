const express = require('express');
const db = require('../db');
const winston = require('winston');
const play = require('../play/play');

let router = express.Router();
module.exports = router;

router.get("/", async (req, res) => {
    if (!req.authUser) {
        res.status(401).send({
            "error":" authentication.invalid"
        });
    } else {
        try {
            let friends = [];
            let results;
            
            //TODO: Build the list of friends
            results = await db.query(`SELECT first.id AS firstId, SECOND.id AS secondId, first.username AS first, second.username AS second FROM users AS first, users AS second, friends WHERE friends.firstUser = first.id AND friends.secondUser = second.id AND (friends.firstUser=$1 OR friends.secondUser=$1)`, [
                req.authUser.userId
            ]);
            for (let row of results.rows) {
                let username;
                if (row.firstId == req.authUser.userId) {
                    username = row.second;
                } else {
                    username = row.first;
                }
                friends.push({
                    username: username,
                    status: "friend"
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
            "error":" authentication.invalid"
        });
    } else {
        try {
            //Get the user that we want to be made friends with
            let result = await db.query(`SELECT id FROM users WHERE username=$1`, [
                req.body.username
            ]);
            if (result.rowCount == 0) {
                //This user does not exist
                res.status(400).send({
                    "error": "user.unknownTarget"
                });
                return;
            }
            
            //Make sure we're not already friends
            result = await db.query(`SELECT * FROM friends WHERE (friends.firstUser=$1 AND friends.secondUser=$2) OR (friends.firstUser=$2 OR friends.secondUser=$1)`, [
                req.authUser.userId, targetId
            ]);
            if (result.rowCount != 0) {
                //These users are already friends
                res.status(400).send({
                    "error": "friends.alreadyFriends"
                });
                return;
            }
            
            let targetId = result.rows[0].id;
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

router.post("/acceptByUsername", async (req, res) => {
    if (!req.body.username) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else if (!req.authUser) {
        res.status(401).send({
            "error":" authentication.invalid"
        });
    } else {
        try {
            //Get the user that we want to be made friends with
            let result = await db.query(`SELECT id FROM users WHERE username=$1`, [
                req.body.username
            ]);
            if (result.rowCount == 0) {
                //This user does not exist
                res.status(400).send({
                    "error": "user.unknownTarget"
                });
                return;
            }
            
            //Check if we've got an active request
            let targetId = result.rows[0].id;
            result = await db.query(`SELECT * FROM friendRequests WHERE requester=$1 AND target=$2`, [
                req.authUser.userId, targetId
            ]);
            if (result.rowCount == 0) {
                //There is no pending request
                res.status(400).send({
                    "error": "friends.noPendingRequest"
                });
                return;
            }
            
            //Make friends
            await db.query(`DELETE FROM friendRequests WHERE requester=$1 AND target=$2`, [
                req.authUser.userId, targetId
            ]);
            await db.query(`INSERT INTO friends(firstUser, secondUser) VALUES($1, $2)`, [
                req.authUser.userId, targetId
            ]);
            
            play.beam(targetId, {
                system: true,
                type: "friendRequestAccepted",
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
