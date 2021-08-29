const db = require('../db');
const accounts = require('../accounts-dbus');

module.exports = async (req, res, next) => {
    let authHeader = req.get("Authorization");
    if (authHeader && authHeader.startsWith("Token ")) {
        let token = authHeader.substr(6);
        
        req.token = token;
        
        //Check the token
        try {
            let userPath = await accounts.manager().UserForToken(token);
            let user = await accounts.path(userPath);
            let userProperties = user.getInterface("org.freedesktop.DBus.Properties");

            req.authUser = {
                username: (await userProperties.Get("com.vicr123.accounts.User", "Username")).value,
                email: (await userProperties.Get("com.vicr123.accounts.User", "Email")).value,
                verified: (await userProperties.Get("com.vicr123.accounts.User", "Verified")).value,
                userId: Number((await userProperties.Get("com.vicr123.accounts.User", "Id")).value),
            }
            req.authUserToken = token;
            req.authUserDbus = user;
        } catch {

        }
    }
    
    req.sendTimed401 = (error) => {
        setTimeout(() => {
            res.status(401).send({
                "error": error
            });
        }, 1000);
    };
    
    next();
};