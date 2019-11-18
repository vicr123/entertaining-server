const nodemailer = require('nodemailer');
const nconf = require('nconf');
const winston = require('winston');
const fs = require('fs');

const mailConfig = nconf.get("mail");

let transport = null;
if (mailConfig) {
    transport = nodemailer.createTransport(mailConfig.server);
}

class Mail {
    static async send(message) {
        if (transport) {
            message.from = mailConfig.from;
            await transport.sendMail(message);
        } else {
            winston.log("warn", "Tried to send and email but email support is not currently configured.");
        }
    }
    
    static async sendTemplate(to, template, values) {
        if (!fs.existsSync(`./mailTemplates/${template}`)) throw new Error(`Invalid Mail template ${template} specified`);
        
        let metadata = JSON.parse(fs.readFileSync(`./mailTemplates/${template}/metadata.json`, {
            encoding: "utf8"
        }));
        
        let replaceFile = (file) => {
            let contents = fs.readFileSync(file, {
                encoding: "utf8"
            });
            return contents.replace(/\${([^}]*)}/g, (match, p1) => {
                return values[p1];
            });
        }
        
        let message = {
            to: to,
            subject: metadata.subject,
            html: replaceFile(`./mailTemplates/${template}/message.html`),
            text: replaceFile(`./mailTemplates/${template}/message.txt`)
        };
        Mail.send(message);
    }
}

module.exports = Mail;