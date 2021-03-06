const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../db');
const nconf = require('nconf');
const winston = require('winston');
const otplib = require('otplib');
const mail = require('../mail');
const queueMiddleware = require("../middleware/queue");
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
    
    let currentDate = moment.utc().unix();
    response = await db.query("SELECT temporaryPassword, expiry FROM passwordResets WHERE userId=$1 AND expiry>$2", [
        userId, currentDate
    ]);
    if (response.rowCount !== 0) {
        let row = response.rows[0];
        if (await bcrypt.compare(sha256, row.temporarypassword)) {
            return "recovery";
        }
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
    
//     await db.query("DELETE FROM verifications WHERE userId=$1", [
//         userId
//     ]);
    await db.query("INSERT INTO verifications(userId, verificationString, expiry) VALUES($1, $2, $3) ON CONFLICT (userId) DO UPDATE SET verificationString=$2, expiry=$3", [
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
router.route("/token")
    .all(queueMiddleware())
    .post(async function(req, res) {
        if (!req.body.username || !req.body.password) {
            res.status(400).send({
                "error": "fields.missing"
            });
        } else {
            try {
                let username = req.body.username.trim();
                
                //Retrieve the user from the database
                let response = await db.query("SELECT * FROM users WHERE username=$1", [username]);
                if (response.rowCount === 0) {
                    req.sendTimed401("authentication.incorrect");
                    return;
                }
                
                let row = response.rows[0];
                let id = row.id;
                
                //Verify the password
                let isPasswordCorrect = await verifyPassword(id, req.body.password);
                if (isPasswordCorrect !== "ok") {
                    if (isPasswordCorrect === "recovery") {
                        if (!req.body.newPassword) {
                            req.sendTimed401("authentication.changePassword");
                            return;
                        } else {
                            //Change the password for this user
                            let mixedPassword = await mixPassword(req.body.newPassword);
                            
                            //Update the database
                            await db.query("UPDATE users SET password=$2 WHERE id=$1", [
                                id, mixedPassword
                            ]);
                            
                            //Clear out all tokens
                            await db.query("DELETE FROM tokens WHERE userId=$1", [
                                id
                            ]);
                            
                            //Clear out the reset password
                            await db.query("DELETE FROM passwordResets WHERE userId=$1", [
                                id
                            ]);
                            
                            //Tell the user
                            if (row.verified) {
                                mail.sendTemplate(row.email, "passwordChanged", {
                                    name: username
                                });
                            }
                            
                            //Continue with the auth flow
                        }
                    } else {
                        req.sendTimed401("authentication.incorrect");
                        return;
                    }
                }
                
                //Verify the OTP token
                let isOtpCorrect = await verifyOtp(id, req.body.otpToken);
                if (!isOtpCorrect) {
                    if (!req.body.otpToken || req.body.otpToken === "") {
                        res.status(401).send({
                            "error": "otp.required"
                        });
                    } else {
                        req.sendTimed401("otp.incorrect");
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
        req.sendTimed401("authentication.invalid");
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
        req.sendTimed401("authentication.invalid");
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
router.route("/changeUsername")
    .all(queueMiddleware())
    .post(async function(req, res) {
        if (!req.body.password || !req.body.username) {
            res.status(400).send({
                "error": "fields.missing"
            });
        } else if (!req.authUser) {
            req.sendTimed401("authentication.invalid");
        } else {
            try {
                //Ensure the password is correct
                let isPasswordCorrect = await verifyPassword(req.authUser.userId, req.body.password);
                if (isPasswordCorrect !== "ok") {
                    req.sendTimed401("authentication.incorrect");
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
/**
 * @api {post} /users/changePassword Change current user's password
 * @apiName ChangePassword
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiSampleRequest /users/changePassword
 *
 * @apiParam {String} password     Current password for the user.
 * @apiParam {String} newPassword  New password for the user.
 */
router.route("/changePassword")
    .all(queueMiddleware())
    .post(async function(req, res) {
        if (!req.body.password || !req.body.newPassword) {
            res.status(400).send({
                "error": "fields.missing"
            });
        } else if (!req.authUser) {
            req.sendTimed401("authentication.invalid");
        } else {
            try {
                //Ensure the password is correct
                let isPasswordCorrect = await verifyPassword(req.authUser.userId, req.body.password);
                if (isPasswordCorrect !== "ok") {
                    req.sendTimed401("authentication.incorrect");
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
                
                //Tell the user
                if (req.authUser.verified) {
                    mail.sendTemplate(req.authUser.email, "passwordChanged", {
                        name: req.authUser.username
                    });
                }
                
                res.status(204).send();
            } catch (error) {
                //Internal Server Error
                res.status(500).send();
            }
        }
    });

router.route("/recoverPassword")
    .all(queueMiddleware())
    .post(async function(req, res) {
        try {
            if (req.body.username && req.body.email) {
                //Immediately return an OK because we don't want a potential attacker to know
                //if the email matches or not
                res.status(204).send();
                
                //Get the email for this user and check to see if it matches
                let result = await db.query("SELECT id, email FROM users WHERE username=$1", [
                    req.body.username
                ]);
                if (result.rowCount === 0) return;
                
                let row = result.rows[0];
                if (row.email === req.body.email) {
                    //Generate a random password
                    let randomPassword = crypto.randomBytes(24).toString('base64');
                    let hashed = await mixPassword(randomPassword);
                    
                    //Put this in the database
                    let expiry = moment.utc().add(30, 'minutes').unix();
                    
                    await db.query("INSERT INTO passwordResets(userId, temporaryPassword, expiry) VALUES($1, $2, $3) ON CONFLICT (userId) DO UPDATE SET temporaryPassword=$2, expiry=$3", [
                        row.id, hashed, expiry
                    ]);
                    
                    //Send the password reset email
                    await mail.sendTemplate(row.email, "passwordReset", {
                        name: req.body.username,
                        tempPassword: randomPassword
                    });
                }
            } else if (req.body.username) {
                //Get the email for this user, obfuscate it and send it back
                let result = await db.query("SELECT email FROM users WHERE username=$1", [
                    req.body.username
                ]);
                if (result.rowCount === 0) {
                    req.sendTimed401("authentication.incorrect");
                    return;
                }
                
                let email = result.rows[0].email;
                let obfuscated = "";
                if (email.length > 0) obfuscated += email[0];
                if (email.length > 1) obfuscated += email[1];
                obfuscated += "∙∙∙";
                if (email.includes("@") && !email.endsWith("@")) {
                    obfuscated += `@${email[email.indexOf("@") + 1]}∙∙∙`;
                }
                
                res.status(200).send({
                    challenge: "email",
                    email: obfuscated
                });
            }
        } catch (error) {
            //Internal Server Error
            res.status(500).send();
        }
    });

router.route("/changeEmail")
    .all(queueMiddleware())
    .post(async function(req, res) {
        if (!req.body.password || !req.body.email) {
            res.status(400).send({
                "error": "fields.missing"
            });
        } else if (!req.authUser) {
            req.sendTimed401("authentication.invalid");
        } else {
            try {
                //Ensure the password is correct
                let isPasswordCorrect = await verifyPassword(req.authUser.userId, req.body.password);
                if (isPasswordCorrect !== "ok") {
                    req.sendTimed401("authentication.incorrect");
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
        req.sendTimed401("authentication.invalid");
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
        req.sendTimed401("authentication.invalid");
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

router.route("/otp/status")
    .all(queueMiddleware())
    .post(async function(req, res) {
        if (!req.body.password) {
            res.status(400).send({
                "error": "fields.missing"
            });
        } else if (!req.authUser) {
            req.sendTimed401("authentication.invalid");
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
        req.sendTimed401("authentication.invalid");
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

router.route("/otp/disable")
    .all(queueMiddleware())
    .post(async function(req, res) {
        if (!req.body.password) {
            res.status(400).send({
                "error": "fields.missing"
            });
        } else if (!req.authUser) {
            req.sendTimed401("authentication.invalid");
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

router.route("/otp/regenerate")
    .all(queueMiddleware())
    .post(async function(req, res) {
        if (!req.body.password) {
            res.status(400).send({
                "error": "fields.missing"
            });
        } else if (!req.authUser) {
            req.sendTimed401("authentication.invalid");
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