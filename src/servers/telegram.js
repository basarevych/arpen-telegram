/**
 * Telegram bot server
 * @module servers/telegram
 */
const Telegraf = require('telegraf');
const TelegrafFlow = require('telegraf-flow');
const LocalSession = require('telegraf-session-local');
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
        this.scenes = new Set();

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

        this.bot = new Telegraf(this._config.get(`servers.${name}.token`));
        this.bot.catch(this.onError.bind(this));
        this.listening = false;

        const session = new LocalSession({ database: this._config.get(`session.file`) });
        this.bot.use(session.middleware());

        this.flow = new TelegrafFlow();
        this.bot.use(this.flow.middleware());

        return Array.from(this.scenes).reduce(
            async (prev, cur) => {
                await prev;

                let result = cur.register(this);
                if (result === null || typeof result !== 'object' || typeof result.then !== 'function')
                    throw new Error(`Scene '${cur.name}' register() did not return a Promise`);
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

        this._logger.debug('Telegram', `${this.name}: Starting the bot`);
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
