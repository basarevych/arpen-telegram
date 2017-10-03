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
     * @param {Filer} filer                 Filer service
     */
    constructor(app, config, logger, filer) {
        this.name = null;

        this._app = app;
        this._config = config;
        this._logger = logger;
        this._filer = filer;
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
        return [ 'app', 'config', 'logger', 'filer' ];
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

        if (this._config.get(`servers.${name}.webhook.enable`)) {
            let key = this._config.get(`servers.${name}.webhook.key`);
            if (key && key[0] !== '/')
                key = path.join(this._config.base_path, key);
            let cert = this._config.get(`servers.${name}.webhook.cert`);
            if (cert && cert[0] !== '/')
                cert = path.join(this._config.base_path, cert);
            let ca = this._config.get(`server.${name}.webhook.ca`);
            if (ca && ca[0] !== '/')
                ca = path.join(this._config.base_path, ca);

            let options = null;
            if (key && cert) {
                let promises = [
                    this._filer.lockReadBuffer(key),
                    this._filer.lockReadBuffer(cert),
                ];
                if (ca)
                    promises.push(this._filer.lockReadBuffer(ca));

                let [keyVal, certVal, caVal] = await Promise.all(promises);
                options = {
                    key: keyVal,
                    cert: certVal,
                };
                if (caVal)
                    options.ca = caVal;
            }

            this.bot.startWebhook(
                this._config.get(`servers.${name}.webhook.path`) || 'bot',
                options,
                this._config.get(`servers.${name}.webhook.port`),
                this._config.get(`servers.${name}.webhook.host`)
            );
        } else {
            this.bot.startPolling();
        }

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
