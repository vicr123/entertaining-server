const db = require('../db');

module.exports = async (req, res, next) => {
    let authHeader = req.get("Authorization");
    if (authHeader && authHeader.startsWith("Token ")) {
        let token = authHeader.substr(6);
        
        req.token = token;
        
        //Check the token
        let row = await db.userForToken(token);
        if (row) {
            req.authUser = row;
            req.authUserToken = token;
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