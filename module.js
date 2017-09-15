/**
 * Telegram module
 * @module telegram/module
 */

/**
 * Module main class
 */
class Telegram {
    /**
     * Create the module
     * @param {App} app                                     The application
     * @param {object} config                               Configuration
     */
    constructor(app, config) {
        this._app = app;
        this._config = config;
    }

    /**
     * Service name is 'modules.telegram'
     * @type {string}
     */
    static get provides() {
        return 'modules.telegram';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [
            'app',
            'config',
        ];
    }
}

module.exports = Telegram;
