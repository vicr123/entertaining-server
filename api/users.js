const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../db');
const nconf = require('nconf');
const winston = require('winston');
const otplib = require('otplib');
const queueMiddleware = require("../middleware/queue");
const moment = require('moment');
const accounts = require('../accounts-dbus');

nconf.defaults({
    "saltRounds": 12,
    "totpWindow": 1
});

otplib.authenticator.options = {
    window: nconf.get("totpWindow")
};

let router = express.Router();
module.exports = router;

async function verifyPassword(userDbus, password) {
    let interface = userDbus.getInterface("com.vicr123.accounts.User");
    let ok = await interface.VerifyPassword(password);
    return ok ? "ok" : "no";
}

async function userIdForPath(path) {
    let userPath = await accounts.path(path);
    let userProperties = userPath.getInterface("org.freedesktop.DBus.Properties");
    let id = (await userProperties.Get("com.vicr123.accounts.User", "Id")).value;
    return Number(id);
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

            let user = await accounts.manager().CreateUser(username, req.body.password, email);
            let token = await accounts.manager().ProvisionToken(username, req.body.password, "Entertaining Games", {});

            let userId = await userIdForPath(user);

            await db.query("INSERT INTO terms(userId, termsRead) VALUES($1, true) ON CONFLICT (userId) DO UPDATE SET termsRead=true", [
                userId
            ]);
            
            await res.status(200).send({
                "token": token,
                "id": userId
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
                let password = req.body.password;

                let extraOptions = {};
                if (req.body.otpToken) extraOptions.otpToken = accounts.variant("s", req.body.otpToken);
                if (req.body.newPassword) extraOptions.newPassword = accounts.variant("s", req.body.newPassword.trim());

                let token = await accounts.manager().ProvisionToken(username, password, "Entertaining Games", extraOptions);
                let userPath = await accounts.manager().UserForToken(token);
                
                res.status(200).send({
                    "token": token,
                    "id": await userIdForPath(userPath)
                });
            } catch (error) {
                if (error.name === "DBusError") {
                    switch (error.type) {
                        case "com.vicr123.accounts.Error.NoAccount":
                        case "com.vicr123.accounts.Error.IncorrectPassword":
                            req.sendTimed401("authentication.incorrect");
                            return;
                        case "com.vicr123.accounts.Error.DisabledAccount":
                            req.sendTimed401("authentication.disabled");
                            return;
                        case "com.vicr123.accounts.Error.PasswordResetRequired":
                            req.sendTimed401("authentication.changePassword");
                            return;
                        case "com.vicr123.accounts.Error.PasswordResetRequestRequired":
                            req.sendTimed401("authentication.requestPasswordChange");
                            return;
                        case "com.vicr123.accounts.Error.TwoFactorRequired":
                            if (!req.body.otpToken || req.body.otpToken === "") {
                                res.status(401).send({
                                    "error": "otp.required"
                                });
                            } else {
                                req.sendTimed401("otp.incorrect");
                            }
                            return;
                    }
                }
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
            await db.query("INSERT INTO terms(userId, termsRead) VALUES($1, true) ON CONFLICT (userId) DO UPDATE SET termsRead=true", [
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
                let isPasswordCorrect = await verifyPassword(req.authUserDbus, req.body.password);
                if (isPasswordCorrect !== "ok") {
                    req.sendTimed401("authentication.incorrect");
                    return;
                }
                
                let username = req.body.username.trim();
                
                //Update the database
                let interface = req.authUserDbus.getInterface("com.vicr123.accounts.User");
                await interface.SetUsername(username);
                
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
                let isPasswordCorrect = await verifyPassword(req.authUserDbus, req.body.password);
                if (isPasswordCorrect !== "ok") {
                    req.sendTimed401("authentication.incorrect");
                    return;
                }
                
                //Update the database
                let interface = req.authUserDbus.getInterface("com.vicr123.accounts.User");
                await interface.SetPassword(req.body.newPassword);
                
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

            if (req.body.username) {
                let userId = await accounts.manager().UserIdByUsername(req.body.username);
                let userPath = await accounts.manager().UserById(userId);
                let userDbus = await accounts.path(userPath);

                let interface = userDbus.getInterface("com.vicr123.accounts.PasswordReset");

                if (req.body.email) {
                    //Immediately return an OK because we don't want a potential attacker to know
                    //if the email matches or not
                    res.status(204).send();
    
                    //Request the password reset
                    await interface.ResetPassword("email", {
                        "email": accounts.variant('s', req.body.email)
                    });
                } else {
                    let methods = await interface.ResetMethods();

                    //TODO
                    for (let method of methods) {
                        if (method[0] === "email") {
                            res.status(200).send({
                                challenge: "email",
                                email: `${method[1].user.value}∙∙∙@${method[1].domain.value}∙∙∙`
                            });
                            return;
                        }
                    }
                    res.status(500).send();

                }
            } else {
                res.statusCode(400);
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
                let isPasswordCorrect = await verifyPassword(req.authUserDbus, req.body.password);
                if (isPasswordCorrect !== "ok") {
                    req.sendTimed401("authentication.incorrect");
                    return;
                }
                
                let email = req.body.email.trim();

                //Update the database
                let interface = req.authUserDbus.getInterface("com.vicr123.accounts.User");
                await interface.SetEmail(email);
                
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
            let interface = req.authUserDbus.getInterface("com.vicr123.accounts.User");
            await interface.ResendVerificationEmail();
            
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
            try {
                let interface = req.authUserDbus.getInterface("com.vicr123.accounts.User");
                await interface.VerifyEmail("" + req.body.verificationCode);

                res.status(204).send();
            } catch {
                res.status(400).send({
                    "error": "verification.invalid"
                });
            }
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
                let isPasswordCorrect = await verifyPassword(req.authUserDbus, req.body.password);
                if (isPasswordCorrect !== "ok") {
                    res.status(401).send();
                    return;
                }

                let interface = req.authUserDbus.getInterface("com.vicr123.accounts.TwoFactor");
                let properties = req.authUserDbus.getInterface("org.freedesktop.DBus.Properties");

                if ((await properties.Get("com.vicr123.accounts.TwoFactor", "TwoFactorEnabled")).value) {
                    res.status(200).send({
                        "enabled": true,
                        "codes": (await properties.Get("com.vicr123.accounts.TwoFactor", "BackupKeys")).value.map(keys => ({
                            code: keys[0],
                            used: keys[1]
                        }))
                    });
                } else {
                    res.status(200).send({
                        "enabled": false,
                        "otpKey": await interface.GenerateTwoFactorKey()
                    });
                }
            } catch (error) {
                //Internal Server Error
                winston.log("error", error.message);
                res.status(500).send();
            }
        }
    });

router.post("/otp/enable", async function(req, res) {
    if (!req.body.otpToken) {
        res.status(400).send({
            "error": "fields.missing"
        });
    } else if (!req.authUser) {
        req.sendTimed401("authentication.invalid");
    } else {
        try {
            let interface = req.authUserDbus.getInterface("com.vicr123.accounts.TwoFactor");
            let properties = req.authUserDbus.getInterface("org.freedesktop.DBus.Properties");
            await interface.EnableTwoFactorAuthentication(req.body.otpToken);
            
            res.status(200).send({
                "status": "ok",
                "backup": (await properties.Get("com.vicr123.accounts.TwoFactor", "BackupKeys")).value.map(keys => ({
                    code: keys[0],
                    used: keys[1]
                }))
            });
        } catch (error) {
            if (error.name === "DBusError") {
                switch (error.type) {
                    case "com.vicr123.accounts.Error.TwoFactorEnabled":
                        res.status(400).send({
                            "error": "otp.alreadyEnabled"
                        });
                        return;
                    case "com.vicr123.accounts.Error.TwoFactorRequired":
                        res.status(401).send({
                            "error": "otp.invalidToken"
                        });
                        return;
                }
            }

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
                let isPasswordCorrect = await verifyPassword(req.authUserDbus, req.body.password);
                if (isPasswordCorrect !== "ok") {
                    res.status(401).send();
                    return;
                }

                let interface = req.authUserDbus.getInterface("com.vicr123.accounts.TwoFactor");
                await interface.DisableTwoFactorAuthentication();
                
                res.status(204).send();
            } catch (error) {
                if (error.name === "DBusError") {
                    switch (error.type) {
                        case "com.vicr123.accounts.Error.TwoFactorDisabled":
                            res.status(401).send({
                                "error": "otp.alreadyDisabled"
                            });
                            return;
                    }
                }

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
                let isPasswordCorrect = await verifyPassword(req.authUserDbus, req.body.password);
                if (isPasswordCorrect !== "ok") {
                    res.status(401).send();
                    return;
                }

                let interface = req.authUserDbus.getInterface("com.vicr123.accounts.TwoFactor");
                let properties = req.authUserDbus.getInterface("org.freedesktop.DBus.Properties");
                await interface.RegenerateBackupKeys();
                
                res.status(200).send({
                    "status": "ok",
                    "backup": (await properties.Get("com.vicr123.accounts.TwoFactor", "BackupKeys")).value.map(keys => ({
                        code: keys[0],
                        used: keys[1]
                    }))
                });
            } catch (error) {
                if (error.name === "DBusError") {
                    switch (error.type) {
                        case "com.vicr123.accounts.Error.TwoFactorDisabled":
                            res.status(401).send({
                                "error": "otp.alreadyDisabled"
                            });
                            return;
                    }
                }

                //Internal Server Error
                winston.log("error", error.message);
                res.status(500).send();
            }
        }
    });