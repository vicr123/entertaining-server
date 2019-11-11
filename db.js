const pg = require('pg');
const nconf = require('nconf');
const winston = require('winston');

class Database {
    #pool;
    
    async init() {
        winston.log("verbose", "Preparing database...");
        nconf.required(["database"]);
        
        const pool = new pg.Pool(nconf.get("database"));
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
        let response = await this.query("SELECT users.id, users.username FROM users NATURAL JOIN tokens WHERE tokens.token=$1", [
            token
        ]);
        if (response.rowCount === 0) {
            return null;
        }
        
        let row = response.rows[0];
        return {
            username: row.username,
            userId: row.id
        };
    }
}

module.exports = new Database();