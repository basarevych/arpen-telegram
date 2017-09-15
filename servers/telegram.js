/**
 * Telegram bot server
 * @module servers/telegram
 */
const Telegraf = require('telegraf');
const TelegrafFlow = require('telegraf-flow');
const LocalSession = require('telegraf-session-local');
const NError = require('nerror');
const { Scene } = TelegrafFlow;

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

        const flow = new TelegrafFlow();
        this.bot.use(flow.middleware());

        for (let scene of this.scenes) {
            let teleScene = new Scene(scene.name);
            if (scene.onEnter)
                teleScene.enter(scene.onEnter.bind(scene));

            flow.register(teleScene);
            this.bot.command(scene.name, ctx => ctx.flow.enter(scene.name));
        }
    }

    /**
     * Start the server
     * @param {string} name                     Config section name
     * @return {Promise}
     */
    async start(name) {
        if (name !== this.name)
            throw new Error(`Server ${name} was not properly initialized`);

        this._logger.debug('telegraf', `${this.name}: Starting the bot`);
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

    onError(error) {
        this._logger.error(new NError(error, 'Telegram.onError()'));
    }
}

module.exports = Telegram;
