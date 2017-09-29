/**
 * Telegram commands middleware
 * @module telegram/middleware/commander
 */

/**
 * Telegram commands
 */
class Commander {
    /**
     * Create the service
     * @param {App} app                 The application
     */
    constructor(app) {
        this._app = app;
    }

    /**
     * Service name is 'telegram.commander'
     * @type {string}
     */
    static get provides() {
        return 'telegram.commander';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app' ];
    }

    /**
     * Register middleware
     * @param {Telegram} server         The server
     * @return {Promise}
     */
    async register(server) {
        server.commander = this._app.get('telegram.commander');
        server.bot.use(server.commander.middleware());
    }
}

module.exports = Commander;
