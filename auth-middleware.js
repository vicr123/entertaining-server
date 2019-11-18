const db = require('./db');

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
    
    next();
};