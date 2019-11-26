const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../db');
const nconf = require('nconf');
const winston = require('winston');
const otplib = require('otplib');
const mail = require('../mail');
const moment = require('moment');

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
    let sha256 = "sha256-" + crypto.createHash('sha256').update(password).digest('base64');
    
    //Verify the sha256 hashed password
    let isPasswordCorrect = await bcrypt.compare(sha256, hashedPassword);
    if (isPasswordCorrect) {
        return "ok";
    }
    
    //Verify the password
    isPasswordCorrect = await bcrypt.compare(password, hashedPassword);
    if (isPasswordCorrect) {
        //Update the password
        let newPassword = await mixPassword(password);
        await db.query("UPDATE users SET password=$2 WHERE id=$1", [
            userId, newPassword
        ]);
        return "ok";
    }
    
    return "no";
}

async function verifyOtp(userId, otpToken) {
    
    let result = await db.query("SELECT otpKey FROM otp WHERE userId=$1 AND enabled=true", [
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

async function checkUsername(username) {
    //Ensure the username is within limits
    if (username.length > 32) {
        return "username.tooLong";
    }
    
    if (!/^[A-Za-z0-9 ]+$/.test(username)) {
        return "username.bad";
    }
    
    return "ok";
}

async function checkEmail(email) {
    if (!/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email)) {
        return "email.bad";
    }
    return "ok";
}

async function mixPassword(password) {
    let sha256 = "sha256-" + crypto.createHash('sha256').update(password).digest('base64');
    let passwordHash = await bcrypt.hash(sha256, nconf.get("saltRounds"));
    
    return passwordHash;
}

async function sendVerificationMail(userId) {
    let result = await db.query("SELECT username, email FROM users WHERE id=$1", [
        userId
    ]);
    if (result.rowCount === 0) {
        return;
    }
    
    let row = result.rows[0];
    
    let expiry = moment.utc().add(1, 'days').unix();
    let verification = "" + Math.floor(Math.random() * 900000 + 100000);
    
    await db.query("DELETE FROM verifications WHERE userId=$1", [
        userId
    ]);
    await db.query("INSERT INTO verifications(userId, verificationString, expiry) VALUES($1, $2, $3)", [
        userId, verification, expiry
    ]);
    
    await mail.sendTemplate(row.email, "verifyEmail", {
        name: row.username,
        code: verification
    });
}

/**
 * @api {post} /users/create Create a user
 * @apiName CreateUser
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiSampleRequest /users/create
 *
 * @apiParam {String} username    Username of the user to create.
 * @apiParam {String} password    Password for the new user.
 * @apiParam {String} email       Email of the new user.
 *
 * @apiSuccess {String} token     Token for the new user.
 * @apiSuccess {String} id        User ID of the new user.
 */
router.post("/create", async function(req, res) {
    if (!req.body.username || !req.body.password || !req.body.email) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else {
        try {
            let username = req.body.username.trim();
            let email = req.body.email.trim();
            
            let usernameOk = await checkUsername(username);
            if (usernameOk !== "ok") {
                res.status(401).send({
                    "error": usernameOk
                });
                return;
            }
            
            let emailOk = await checkEmail(email);
            if (emailOk !== "ok") {
                res.status(401).send({
                    "error": emailOk
                });
                return;
            }
                        
            //Prepare the password for storage
            let mixedPassword = await mixPassword(req.body.password);
            let result = await db.query("INSERT INTO users(username, password, email) VALUES($1, $2, $3) RETURNING id", [
                username, mixedPassword, email
            ]);
                        
            //Get the user ID
            let id = result.rows[0].id;
            
            //Get the token
            let token = await generateTokenForUser(id);
            
            //Ask the user to verify their account
            sendVerificationMail(id);
            
            await res.status(200).send({
                "token": token,
                "id": id
            });
        } catch (error) {
            if (error.code === "23505") { //unique_violation
                if (error.constraint === "users_username_key") {
                    res.status(409).send({
                        "error": "username.taken"
                    });
                    return;
                } else if (error.constraint === "users_email_key") {
                    res.status(409).send({
                        "error": "email.taken"
                    });
                    return;
                }
            }
            
            //Internal Server Error
            res.status(500).send();
        }
    }
});

/**
 * @api {post} /users/token Get Token for a user
 * @apiName UserToken
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiSampleRequest /users/token
 *
 * @apiParam {String} username    Username for the user.
 * @apiParam {String} password    Password for the user.
 * @apiParam {String} [otpToken]  TOTP Token for the user.
 *
 * @apiSuccess {String} token     Token for the new user.
 * @apiSuccess {String} id        User ID of the new user.
 * 
 * @apiError {String} otp.required TOTP Token is required for this user.
 */
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
                res.status(401).send({
                    "error": "authentication.incorrect"
                });
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

/**
 * @api {post} /users/acceptTerms Accept the terms and community guidelines
 * @apiName UserAcceptTerms
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiSampleRequest /users/acceptTerms
 */
router.post("/acceptTerms", async function(req, res) {
    if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            await db.query("UPDATE users SET termsRead=true WHERE id=$1", [
                req.authUser.userId
            ]);
            
            res.status(204).send();
        } catch (error) {
            //Internal Server Error
            res.status(500).send();
        }
    }
});

/**
 * @api {get} /users/profile Get logged in user's profile
 * @apiName UserProfile
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiSampleRequest /users/profile
 *
 * @apiSuccess {String} username  Username of the current user.
 * @apiSuccess {String} email     Email of the current user.
 * @apiSuccess {String} id        User ID of the current user.
 */
router.get("/profile", async function(req, res) {
    if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            res.status(200).send({
                user: req.authUser
            });
        } catch (error) {
            //Internal Server Error
            res.status(500).send();
        }
    }
});

/**
 * @api {post} /users/changeUsername Change current user's username
 * @apiName ChangeUsername
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiSampleRequest /users/changeUsername
 *
 * @apiParam {String} username  New username for the user.
 * @apiParam {String} password  Current password for the user.
 */
router.post("/changeUsername", async function(req, res) {
    if (!req.body.password || !req.body.username) {
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
                res.status(401).send({
                    "error": "authentication.incorrect"
                });
                return;
            }
            
            let username = req.body.username.trim();
            
            //Ensure the username is okay
            let usernameOk = await checkUsername(username);
            if (usernameOk !== "ok") {
                res.status(401).send({
                    "error": usernameOk
                });
                return;
            }
            
            //Update the database
            await db.query("UPDATE users SET username=$2 WHERE id=$1", [
                req.authUser.userId, username
            ]);
            
            res.status(204).send();
        } catch (error) {
            if (error.code === "23505") { //unique_violation
                if (error.constraint === "users_username_key") {
                    res.status(409).send({
                        "error": "username.taken"
                    });
                    return;
                }
            }
            
            //Internal Server Error
            res.status(500).send();
        }
    }
});

router.post("/changePassword", async function(req, res) {
    if (!req.body.password || !req.body.newPassword) {
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
                res.status(401).send({
                    "error": "authentication.incorrect"
                });
                return;
            }
            
            //Prepare the password for storage
            let mixedPassword = await mixPassword(req.body.newPassword);
            
            //Update the database
            await db.query("UPDATE users SET password=$2 WHERE id=$1", [
                req.authUser.userId, mixedPassword
            ]);
            
            //Clear out all tokens except this one
            await db.query("DELETE FROM tokens WHERE userId=$1 AND NOT token=$2", [
                req.authUser.userId, req.authUserToken
            ]);
            
            res.status(204).send();
        } catch (error) {
            //Internal Server Error
            res.status(500).send();
        }
    }
});

router.post("/changeEmail", async function(req, res) {
    if (!req.body.password || !req.body.email) {
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
                res.status(401).send({
                    "error": "authentication.incorrect"
                });
                return;
            }
            
            let email = req.body.email.trim();
            
            //Ensure the email is not the same
            if (email === req.authUser.email) {
                res.status(401).send({
                    "error": "email.unchanged"
                });
                return;
            }
            
            //Make sure the email is OK
            let emailOk = await checkEmail(email);
            if (emailOk !== "ok") {
                res.status(401).send({
                    "error": emailOk
                });
                return;
            }
            
            //Update the database
            await db.query("UPDATE users SET email=$2, verified=false WHERE id=$1", [
                req.authUser.userId, email
            ]);
            
            //Ask the user to verify their account
            sendVerificationMail(req.authUser.userId);
            
            res.status(204).send();
        } catch (error) {
            //Internal Server Error
            console.log(error);
            res.status(500).send();
        }
    }
});

router.post("/resendVerification", async function(req, res) {
    if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            //Ask the user to verify their account
            sendVerificationMail(req.authUser.userId);
            
            res.status(204).send();
        } catch (error) {
            //Internal Server Error
            res.status(500).send();
        }
    }
});

router.post("/verifyEmail", async function(req, res) {
    if (!req.body.verificationCode) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else if (!req.authUser) {
        res.status(401).send({
            "error": "authentication.invalid"
        });
    } else {
        try {
            let currentDate = moment.utc().unix();
            
            //Check if the verification code is correct
            let result = await db.query("SELECT * FROM verifications WHERE userId=$1 AND verificationString=$2 AND expiry>$3", [
                req.authUser.userId, "" + req.body.verificationCode, currentDate
            ]);
            if (result.rowCount === 0) {
                res.status(400).send({
                    "error": "verification.invalid"
                });
                return;
            }
            
            //Verify the email address
            await db.query("DELETE FROM verifications WHERE userId=$1", [
                req.authUser.userId
            ]);
            await db.query("UPDATE users SET verified=true WHERE id=$1", [
                req.authUser.userId
            ]);
            
            res.status(204).send();
        } catch (error) {
            //Internal Server Error
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
            
            //Make sure OTP tokens are currently disabled
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