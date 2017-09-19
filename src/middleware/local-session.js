/**
 * Error handling middleware
 * @module telegram/middleware/local-session
 */
const TgLocalSession = require('telegraf-session-local');

/**
 * Local session
 */
class LocalSession {
    /**
     * Create the service
     * @param {object} config           Configuration
     */
    constructor(config) {
        this._config = config;
    }

    /**
     * Service name is 'telegram.localSession'
     * @type {string}
     */
    static get provides() {
        return 'telegram.localSession';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'config' ];
    }

    /**
     * Register middleware
     * @param {Telegram} server         The server
     * @return {Promise}
     */
    async register(server) {
        const session = new TgLocalSession({ database: this._config.get(`servers.${server.name}.session_file`) });
        server.bot.use(session.middleware());
    }
}

module.exports = LocalSession;
