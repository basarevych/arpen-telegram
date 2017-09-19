/**
 * Telegram bot server
 * @module telegram/servers/telegram
 */
const Telegraf = require('telegraf');
const NError = require('nerror');

/**
 * Bot server class
 */
class Telegram {
    /**
     * Create the service
     * @param {App} app                     Application
     * @param {object} config               Configuration
     * @param {Logger} logger               Logger service
     */
    constructor(app, config, logger) {
        this.name = null;

        this._app = app;
        this._config = config;
        this._logger = logger;
    }

    /**
     * Service name is 'servers.telegram'
     * @type {string}
     */
    static get provides() {
        return 'servers.telegram';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger' ];
    }

    /**
     * Register new scene
     * @param {object} scene                    Scene instance
     */
    registerScene(scene) {
        this.scenes.add(scene);
    }

    /**
     * Initialize the server
     * @param {string} name                     Config section name
     * @return {Promise}
     */
    async init(name) {
        this.name = name;

        this._logger.debug('telegram', `${this.name}: Creating server`);
        this.bot = new Telegraf(this._config.get(`servers.${name}.token`));
        this.bot.catch(this.onError.bind(this));
        this.listening = false;

        let middlewareConfig = this._config.get(`servers.${name}.middleware`);
        if (!Array.isArray(middlewareConfig))
            return;

        this._logger.debug('telegram', `${this.name}: Loading middleware`);
        let middleware;
        if (this._app.has('telegram.middleware')) {
            middleware = this._app.get('telegram.middleware');
        } else {
            middleware = new Map();
            this._app.registerInstance(middleware, 'telegram.middleware');
        }

        return middlewareConfig.reduce(
            async (prev, cur) => {
                await prev;

                let obj;
                if (middleware.has(cur)) {
                    obj = middleware.get(cur);
                } else {
                    obj = this._app.get(cur);
                    middleware.set(cur, obj);
                }

                this._logger.debug('express', `${this.name}: Registering middleware ${cur}`);
                let result = obj.register(this);
                if (result === null || typeof result !== 'object' || typeof result.then !== 'function')
                    throw new Error(`Middleware '${cur}' register() did not return a Promise`);
                return result;
            },
            Promise.resolve()
        );
    }

    /**
     * Start the server
     * @param {string} name                     Config section name
     * @return {Promise}
     */
    async start(name) {
        if (name !== this.name)
            throw new Error(`Server ${name} was not properly initialized`);

        this._logger.debug('telegram', `${this.name}: Starting the bot`);
        this.bot.startPolling();
        this.listening = true;
    }

    /**
     * Stop the server
     * @param {string} name                     Config section name
     * @return {Promise}
     */
    async stop(name) {
        if (name !== this.name)
            throw new Error(`Server ${name} was not properly initialized`);

        if (this.bot && this.listening) {
            this.bot.stop();
            this.bot = null;
            this.listening = false;
        }
    }

    /**
     * Handle bot errors
     * @param {Error} error                     Error object
     */
    onError(error) {
        this._logger.error(new NError(error, 'Telegram.onError()'));
    }
}

module.exports = Telegram;
