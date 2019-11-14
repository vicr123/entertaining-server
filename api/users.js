const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../db');
const nconf = require('nconf');
const winston = require('winston');
const otplib = require('otplib');


nconf.defaults({
    "saltRounds": 12,
    "totpWindow": 1
});

otplib.authenticator.options = {
    window: nconf.get("totpWindow")
};

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

async function verifyPassword(userId, password) {
    //Retrieve the user from the database
    let response = await db.query("SELECT password FROM users WHERE id=$1", [userId]);
    if (response.rowCount === 0) {
        return "noUser";
    }
    
    let hashedPassword = response.rows[0].password;
    
    //Verify the password
    let isPasswordCorrect = await bcrypt.compare(password, hashedPassword);
    if (isPasswordCorrect) {
        return "ok";
    } else {
        return "no";
    }
}

async function verifyOtp(userId, otpToken) {
    
    let result = await db.query("SELECT otpKey, enabled FROM otp WHERE userId=$1", [
        userId
    ]);
    if (result.rowCount === 0) {
        //OTP is disabled for this user
        return true;
    }
    
    let row = result.rows[0];
    
    //Check if the OTP token matches the current key
    if (otplib.authenticator.check(otpToken, row.otpkey)) return true;
    
    //Check if the OTP token matches a backup key
    result = await db.query("SELECT * FROM otpBackup WHERE userId=$1 AND backupKey=$2 AND used=false", [
        userId, otpToken
    ]);
    if (result.rowCount !== 0) {
        //Mark this backup key as used
        await db.query("UPDATE otpBackup SET used=true WHERE userId=$1 AND backupKey=$2", [
            userId, otpToken
        ]);
        return true;
    }
    
    //Couldn't verify the OTP token
    return false;
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
        try {
            let username = req.body.username.trim();
            
            //Retrieve the user from the database
            let response = await db.query("SELECT id FROM users WHERE username=$1", [username]);
            if (response.rowCount === 0) {
                res.status(401).send();
                return;
            }
            
            let id = response.rows[0].id;
            
            //Verify the password
            let isPasswordCorrect = await verifyPassword(id, req.body.password);
            if (isPasswordCorrect !== "ok") {
                res.status(401).send({
                    "error": "authentication.incorrect"
                });
                return;
            }
            
            //Verify the OTP token
            let isOtpCorrect = await verifyOtp(id, req.body.otpToken);
            if (!isOtpCorrect) {
                if (!req.body.otpToken || req.body.otpToken === "") {
                    res.status(401).send({
                        "error": "otp.required"
                    });
                } else {
                    res.status(401).send({
                        "error": "otp.incorrect"
                    });
                }
                return;
            }
            
            //Generate a token
            let token = await generateTokenForUser(id);
            
            res.status(200).send({
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

router.post("/otp/status", async function(req, res) {
    if (!req.body.password) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            //Ensure the password is correct
            let isPasswordCorrect = await verifyPassword(req.authUser.userId, req.body.password);
            if (isPasswordCorrect !== "ok") {
                res.status(401).send();
                return;
            }
            
            //Check if there is an OTP registered
            let result = await db.query("SELECT * FROM otp WHERE userId=$1 AND enabled=true", [
                req.authUser.userId
            ]);
            if (result.rowCount === 0) {
                //OTP is not registered, set up a new OTP key
                await db.query("DELETE FROM otp WHERE userId=$1", [
                    req.authUser.userId
                ]);
                
                const otpKey = otplib.authenticator.generateSecret();
                
                await db.query("INSERT INTO otp(userId, otpKey) VALUES($1, $2)", [
                    req.authUser.userId, otpKey
                ]);
                
                res.status(200).send({
                    "enabled": false,
                    "otpKey": otpKey
                });
            } else {
                //Acquire the backup codes for this user
                let codes = [];
                
                let result = await db.query("SELECT backupKey, used FROM otpBackup WHERE userId=$1", [
                    req.authUser.userId
                ]);
                for (let row of result.rows) {
                    codes.push({
                        code: row.backupkey,
                        used: row.used
                    });
                }
                
                res.status(200).send({
                    "enabled": true,
                    "codes": codes
                });
            }
        } catch (error) {
            //Internal Server Error
            winston.log("error", error.message);
            res.status(500).send();
        }
    }
});

async function generateBackupOtpForUser(userId) {
    let codes = [];
    
    await db.query("DELETE FROM otpBackup WHERE userId=$1", [
        userId
    ]);
    
    for (let i = 0; i < 10; i++) {
        let code = crypto.randomBytes(4);
        let codeString = "";
        
        for (let i = 0; i < code.length; i++) {
            codeString += code[i].toString().padStart(3, '0');
        }
        
        await db.query("INSERT INTO otpBackup(userId, backupKey) VALUES($1, $2)", [
            userId, codeString
        ]);
        codes.push(codeString);
    };
    return codes;
}

router.post("/otp/enable", async function(req, res) {
    if (!req.body.otpToken) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            //Ensure there is a valid OTP token for this user
            let result = await db.query("SELECT otpKey, enabled FROM otp WHERE userId=$1", [
                req.authUser.userId
            ]);
            if (result.rowCount === 0) {
                res.status(400).send({
                    "error": "otp.unavailable"
                });
                return;
            }
            
            //Make sure OTP tokens are currently disabled
            let row = result.rows[0];
            if (row.enabled) {
                res.status(400).send({
                    "error": "otp.alreadyEnabled"
                });
                return;
            }
            
            //Ensure the OTP token provided is correct
            if (!otplib.authenticator.check(req.body.otpToken, row.otpkey)) {
                res.status(401).send({
                    "error": "otp.invalidToken"
                });
                return;
            }
            
            //Enable OTP key
            await db.query("UPDATE otp SET enabled=true WHERE userId=$1", [
                req.authUser.userId
            ]);
            
            //Generate some backup codes
            let backupCodes = await generateBackupOtpForUser(req.authUser.userId);
            
            res.status(200).send({
                "status": "ok",
                "backup": backupCodes
            });
        } catch (error) {
            //Internal Server Error
            winston.log("error", error.message);
            res.status(500).send();
        }
    }
});

router.post("/otp/disable", async function(req, res) {
    if (!req.body.password) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            //Ensure the password is correct
            let isPasswordCorrect = await verifyPassword(req.authUser.userId, req.body.password);
            if (isPasswordCorrect !== "ok") {
                res.status(401).send();
                return;
            }
            
            //Ensure there is a valid OTP token for this user
            let result = await db.query("SELECT otpKey, enabled FROM otp WHERE userId=$1", [
                req.authUser.userId
            ]);
            if (result.rowCount === 0) {
                res.status(401).send({
                    "error": "otp.unavailable"
                });
                return;
            }
            
            //Make sure OTP tokens are currently enabled
            let row = result.rows[0];
            if (!row.enabled) {
                res.status(401).send({
                    "error": "otp.alreadyDisabled"
                });
                return;
            }
            
            //Disable OTP key
            await db.query("DELETE FROM otp WHERE userId=$1", [
                req.authUser.userId
            ]);
            await db.query("DELETE FROM otpBackup WHERE userId=$1", [
                req.authUser.userId
            ]);
                        
            res.status(204).send();
        } catch (error) {
            //Internal Server Error
            winston.log("error", error.message);
            res.status(500).send();
        }
    }
});

router.post("/otp/regenerate", async function(req, res) {
    if (!req.body.password) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            //Ensure the password is correct
            let isPasswordCorrect = await verifyPassword(req.authUser.userId, req.body.password);
            if (isPasswordCorrect !== "ok") {
                res.status(401).send();
                return;
            }
            
            //Ensure there is a valid OTP token for this user
            let result = await db.query("SELECT otpKey, enabled FROM otp WHERE userId=$1", [
                req.authUser.userId
            ]);
            if (result.rowCount === 0) {
                res.status(401).send({
                    "error": "otp.unavailable"
                });
                return;
            }
            
            //Make sure OTP tokens are currently enabled
            let row = result.rows[0];
            if (!row.enabled) {
                res.status(401).send({
                    "error": "otp.alreadyDisabled"
                });
                return;
            }
            
            //Generate some backup codes
            let backupCodes = await generateBackupOtpForUser(req.authUser.userId);
            
            res.status(200).send({
                "status": "ok",
                "backup": backupCodes
            });
        } catch (error) {
            //Internal Server Error
            winston.log("error", error.message);
            res.status(500).send();
        }
    }
});