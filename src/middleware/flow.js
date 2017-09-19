/**
 * Telegram flow middleware
 * @module telegram/middleware/flow
 */
const TelegrafFlow = require('telegraf-flow');

/**
 * Telegram Flow
 */
class Flow {
    /**
     * Service name is 'telegram.flow'
     * @type {string}
     */
    static get provides() {
        return 'telegram.flow';
    }

    /**
     * Register middleware
     * @param {Telegram} server         The server
     * @return {Promise}
     */
    async register(server) {
        server.flow = new TelegrafFlow();
        server.bot.use(server.flow.middleware());
    }
}

module.exports = Flow;
