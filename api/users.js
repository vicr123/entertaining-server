const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../db');
const nconf = require('nconf');
const winston = require('winston');

nconf.defaults({
    "saltRounds": 12
});

let router = express.Router();
module.exports = router;

async function generateTokenForUser(userId) {
    do {
        let token = crypto.randomBytes(64).toString('hex');
        
        //Ensure this token doesn't exist
        let result = await db.query("SELECT COUNT(*) AS count FROM tokens WHERE token=$1", [token]);
        if (result.rows[0].count == '0') {
            await db.query("INSERT INTO tokens(userId, token) VALUES($1, $2)", [
                userId, token
            ]);
            return token;
        }
    } while (true);
}

router.post("/create", async function(req, res) {
    if (!req.body.username || !req.body.password || !req.body.email) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else {
        try {
            let username = req.body.username.trim();
            let email = req.body.email.trim();
                        
            //Hash and salt the password
            let passwordHash = await bcrypt.hash(req.body.password, nconf.get("saltRounds"));
            let result = await db.query("INSERT INTO users(username, password, email) VALUES($1, $2, $3) RETURNING id", [
                username, passwordHash, email
            ]);
                        
            //Get the user ID
            let id = result.rows[0].id;
            
            //Get the token
            let token = await generateTokenForUser(id);
            
            await res.status(200).send({
                "token": token,
                "id": id
            });
        } catch (error) {
            //Internal Server Error
            winston.log("error", error.message);
            res.status(500).send();
        }
    }
});

router.post("/token", async function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else {
        let username = req.body.username.trim();
        
        //Retrieve the user from the database
        let response = await db.query("SELECT id, password FROM users WHERE username=$1", [username]);
        if (response.rowCount === 0) {
            res.status(401).send();
            return;
        }
        
        let row = response.rows[0];
        let hashedPassword = row.password;
        
        //Verify the password
        let isPasswordCorrect = await bcrypt.compare(req.body.password, hashedPassword);
        if (!isPasswordCorrect) {
            res.status(401).send();
            return;
        }
        
        //Generate a token
        let token = await generateTokenForUser(row.id);
        
        res.status(200).send({
            "token": token,
            "id": row.id
        });
    }
});