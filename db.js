const pg = require('pg');
const pgError = require('pg-error');
const nconf = require('nconf');
const winston = require('winston');
const crypto = require('crypto');

pg.Connection.prototype.parseE = pgError.parse;
pg.Connection.prototype.parseN = pgError.parse;

function userObjectForRow(row) {
    return {
        username: row.username,
        userId: row.id,
        email: row.email,
        gravHash: crypto.createHash('md5').update(row.email.trim().toLowerCase()).digest("hex")
    };
}

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
            
            winston.log("verbose", "Creating functions...");
            await client.query(`CREATE OR REPLACE FUNCTION generate_user_id() RETURNS INT AS $$
                                	DECLARE
                                		num INT := 0;
                                		cnt INT := 0;
                                	BEGIN
                                		<<gen>> LOOP
                                			num = floor(random() * 10000000 + 1000000)::INT;
                                			cnt := (SELECT count(*)::INT FROM users WHERE id=num);
                                		   EXIT gen WHEN cnt = 0;
                                		END LOOP;
                                		
                                		RETURN num;
                                	END
                                $$ LANGUAGE plpgsql`);
            
            winston.log("verbose", "Creating tables...");
            await client.query(`CREATE TABLE IF NOT EXISTS users(
                                    id INT DEFAULT generate_user_id() PRIMARY KEY,
                                    username TEXT UNIQUE,
                                    password TEXT,
                                    email TEXT UNIQUE,
                                    verified BOOLEAN DEFAULT false
                                )`);
            await client.query(`CREATE TABLE IF NOT EXISTS otp(
                                    userId INTEGER PRIMARY KEY,
                                    otpKey TEXT,
                                    enabled BOOLEAN DEFAULT false,
                                    CONSTRAINT fk_tokens_userid FOREIGN KEY(userId) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
                                )`);
            await client.query(`CREATE TABLE IF NOT EXISTS otpBackup(
                                    userId INTEGER,
                                    backupKey TEXT,
                                    used BOOLEAN DEFAULT false,
                                    CONSTRAINT pk_otpBackup PRIMARY KEY(userId, backupKey),
                                    CONSTRAINT fk_tokens_userid FOREIGN KEY(userId) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
                                )`);
            await client.query(`CREATE TABLE IF NOT EXISTS tokens(
                                    userId INTEGER,
                                    token TEXT UNIQUE,
                                    CONSTRAINT pk_tokens PRIMARY KEY(userId, token),
                                    CONSTRAINT fk_tokens_userid FOREIGN KEY(userId) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
                                )`);
            await client.query(`CREATE TABLE IF NOT EXISTS verifications(
                                    userId INTEGER,
                                    verificationString TEXT UNIQUE,
                                    CONSTRAINT pk_verifications PRIMARY KEY(userId),
                                    CONSTRAINT fk_verifications_userid FOREIGN KEY(userId) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
                                )`);
            await client.query(`CREATE TABLE IF NOT EXISTS friends(
                                    firstUser INTEGER,
                                    secondUser INTEGER,
                                    CONSTRAINT pk_friends PRIMARY KEY(firstUser, secondUser),
                                    CONSTRAINT fk_friends_firstuser FOREIGN KEY(firstUser) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
                                    CONSTRAINT fk_friends_seconduser FOREIGN KEY(secondUser) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
                                )`);
            await client.query(`CREATE TABLE IF NOT EXISTS friendRequests(
                                    requester INTEGER,
                                    target INTEGER,
                                    CONSTRAINT pk_friendrequests PRIMARY KEY(requester, target),
                                    CONSTRAINT fk_friendrequests_requester FOREIGN KEY(requester) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
                                    CONSTRAINT fk_friendrequests_target FOREIGN KEY(target) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
                                )`);
            await client.query(`CREATE TABLE IF NOT EXISTS blockedUsers(
                                    userId INTEGER,
                                    blockedUser INTEGER,
                                    CONSTRAINT pk_blockedusers PRIMARY KEY(userId, blockedUser),
                                    CONSTRAINT fk_blockedusers_userid FOREIGN KEY(userId) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
                                    CONSTRAINT fk_blockedusers_blockeduser FOREIGN KEY(blockedUser) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
                                )`);
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
        let response = await this.query("SELECT id, username, email FROM users, tokens WHERE tokens.userid = users.id AND tokens.token=$1", [
            token
        ]);
        if (response.rowCount === 0) {
            return null;
        }
        
        let row = response.rows[0];
        return userObjectForRow(row);
    }
    
    async userForUsername(username) {
        let response = await this.query("SELECT id, username, email FROM users WHERE username=$1", [
            username
        ]);
        if (response.rowCount === 0) {
            return null;
        }
        
        let row = response.rows[0];
        return userObjectForRow(row);
    }
    
    async friendsForUserId(userId) {
        //Return all friends
        let friends = [];
        
        let results = await this.query(`SELECT first.id AS firstid, second.id AS secondid, first.username AS first, second.username AS second FROM users AS first, users AS second, friends WHERE friends.firstUser = first.id AND friends.secondUser = second.id AND (friends.firstUser=$1 OR friends.secondUser=$1)`, [
            userId
        ]);
        for (let row of results.rows) {
            let username;
            let peerId;
            if (row.firstid == userId) {
                username = row.second;
                peerId = row.secondid;
            } else {
                username = row.first;
                peerId = row.firstid;
            }
            
            friends.push({
                username: username,
                userId: peerId
            });
        }
        return friends;
    }
}

module.exports = new Database();