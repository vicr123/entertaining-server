const pg = require('pg');
const pgError = require('pg-error');
const nconf = require('nconf');
const winston = require('winston');
const crypto = require('crypto');
const accounts = require('./accounts-dbus');

pg.Connection.prototype.parseE = pgError.parse;
pg.Connection.prototype.parseN = pgError.parse;

class Database {
    #pool;
    
    async init() {
        winston.log("verbose", "Preparing database...");
        nconf.required(["database"]);
        
        const pool = new pg.Pool(nconf.get("database"));
        pool.on('connect', client => {
            let connection = client.connection;
            
            connection.on('PgError', err => {
                switch (err.severity) {
                    case "ERROR":
                    case "FATAL":
                    case "PANIC":
                        return connection.emit("error", err);
                    default:
                        return connection.emit("notice", err);
                }
            });
            client.on('error', err => {
                winston.log("error", `Database: ${err.code} ${err.condition} - ${err.message}`);
            });
        });
        pool.on('error', (err, client) => {
            winston.log("error", err);
        });
        
        //Check that all the tables that we need are created
        let client;
        try {
            client = await pool.connect();

            let tables = await client.query(`SELECT table_name
                                                FROM information_schema.tables
                                                WHERE table_schema = 'public'`);
            
            let version = -1;
            let hasVersionTable = false;

            for (let row of tables.rows) {
                if (row["table_name"] === "version") hasVersionTable = true;
            }

            if (hasVersionTable) {
                let reply = await client.query(`SELECT ver FROM version`);
                version = reply.rows[0]["ver"];
            }

            if (version == -1) {
                //Create a new database
                winston.log("verbose", "Creating functions...");
                
                winston.log("verbose", "Creating tables...");
                await client.query(`CREATE TABLE IF NOT EXISTS version(
                    ver INT PRIMARY KEY
                )`);
                await client.query(`INSERT INTO version(ver) VALUES(1)`)
                await client.query(`CREATE TABLE IF NOT EXISTS terms(
                    userId INTEGER PRIMARY KEY,
                    termsRead BOOLEAN DEFAULT true
                )`);
                await client.query(`CREATE TABLE IF NOT EXISTS friends(
                                        firstUser INTEGER,
                                        secondUser INTEGER,
                                        CONSTRAINT pk_friends PRIMARY KEY(firstUser, secondUser)
                                    )`);
                await client.query(`CREATE TABLE IF NOT EXISTS friendRequests(
                                        requester INTEGER,
                                        target INTEGER,
                                        CONSTRAINT pk_friendrequests PRIMARY KEY(requester, target)
                                    )`);
                await client.query(`CREATE TABLE IF NOT EXISTS blockedUsers(
                                        userId INTEGER,
                                        blockedUser INTEGER,
                                        CONSTRAINT pk_blockedusers PRIMARY KEY(userId, blockedUser)
                                    )`);
            } else {
                if (version <= 1) {
                    //Update to version 2
                    
                }
            }
            
        } catch (err) {
            winston.log("error", err);
        } finally {
            client.release();
        }
        
        this.#pool = pool;
    }
    
    async query(text, params) {
        return await this.#pool.query(text, params);
    }
    
    async userForToken(token) {
        try {
            let userPath = await accounts.manager().UserForToken(token);
            return await userObjectForPath(userPath);
        } catch {
            return null;
        }
    }
    
    async userForUsername(username) {
        try {
            let userId = await accounts.manager().UserIdByUsername(username);
            let userPath = await accounts.manager().UserById(userId);
            return await userObjectForPath(userPath);
        } catch {
            return null;
        }
    }
    
    async friendsForUserId(userId) {
        //Return all friends
        let friends = [];

        let results = await this.query(`SELECT * FROM friends WHERE (friends.firstUser=$1 OR friends.secondUser=$1)`, [
            userId
        ]);
        for (let row of results.rows) {
            let peerId;
            if (row.firstuser === userId) {
                peerId = row.seconduser;
            } else {
                peerId = row.firstuser;
            }

            let path = await accounts.manager().UserById(peerId);
            let userPath = await accounts.path(path);
            let userProperties = userPath.getInterface("org.freedesktop.DBus.Properties");
            let username = (await userProperties.Get("com.vicr123.accounts.User", "Username")).value;

            
            friends.push({
                username: username,
                userId: peerId
            });
        }
        return friends;
    }
}

let db = new Database();

async function userObjectForPath(path) {
    let userPath = await accounts.path(path);
    let userProperties = userPath.getInterface("org.freedesktop.DBus.Properties");

    let username = (await userProperties.Get("com.vicr123.accounts.User", "Username")).value;
    let userId = Number((await userProperties.Get("com.vicr123.accounts.User", "Id")).value);
    let email = (await userProperties.Get("com.vicr123.accounts.User", "Email")).value;
    let verified = (await userProperties.Get("com.vicr123.accounts.User", "Verified")).value;

    let termsRead = false;
    let termsRows = await db.query("SELECT termsRead FROM terms WHERE userId=$1", [userId]);
    if (termsRows.rowCount === 0) {
        // await db.query("INSERT INTO terms(userId, termsRead) VALUES($1, $2)", [userId, false])
        termsRead = "new";
    } else {
        termsRead = termsRows.rows[0]["termsread"];
    }

    return {
        username: username,
        userId: userId,
        email: email,
        gravHash: crypto.createHash('md5').update(email.trim().toLowerCase()).digest("hex"),
        verified: verified,
        termsRead: termsRead
    };
}

module.exports = db;