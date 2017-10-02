/**
 * Telegram command handler
 * @module telegram/services/commander
 */
const natural = require('natural');
const NError = require('nerror');

/**
 * Service class
 */
class Commander {
    /**
     * Create the service
     * @param {App} app                     Application
     * @param {Logger} logger               Logger service
     * @param {Util} util                   Util service
     * @param {I18n} i18n                   I18n service
     */
    constructor(app, logger, util, i18n) {
        this._app = app;
        this._logger = logger;
        this._util = util;
        this._i18n = i18n;

        this.commands = new Map();
        this.callbacks = new Map();
    }

    /**
     * Service name is 'telegram.services.commander'
     * @type {string}
     */
    static get provides() {
        return 'telegram.services.commander';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'logger', 'util', 'i18n' ];
    }

    /**
     * Telegram bot middleware
     * @return {function}
     */
    middleware() {
        return (ctx, next) => {
            ctx.commander = {
                process: this.process.bind(this, ctx),
            };
            return next(ctx);
        };
    }

    /**
     * Add command
     * @param {object} command
     */
    add(command) {
        this.commands.set(command.name, command);
    }

    /**
     * Activate callback
     * @param {object} ctx
     * @param {function} cb
     */
    setCallback(ctx, cb) {
        let id = this._util.getRandomString(32);
        ctx.session.callback = id;
        this.callbacks.set(id, cb);
    }

    /**
     * Process input looking for commands
     * @param {object} ctx
     * @param {object} scene
     * @return {Promise} Resolves to true if command found
     */
    async process(ctx, scene) {
        try {
            if (ctx.session.callback) {
                let callback = this.callbacks.get(ctx.session.callback);
                delete ctx.session.callback;
                if (callback) {
                    this.callbacks.delete(ctx.session.callback);
                    return await callback(this, ctx, scene);
                }
            }

            let triggered = false;
            for (let command of this.commands.values()) {
                if (await command.process(this, ctx, scene))
                    triggered = true;
            }
            return triggered;
        } catch (error) {
            this._logger.error(new NError(error, { ctx }, 'Commander.process()'));
        }
        return false;
    }

    /**
     * Check if input matches syntax
     * @param {string} input
     * @param {object} syntax
     * @return {*}
     */
    match(input, syntax) {
        let results = {};
        for (let variant of Object.keys(syntax)) {
            results[variant] = {};
            for (let re of Object.keys(syntax[variant])) {
                let match = syntax[variant][re].exec(input);
                if (!match) {
                    results[variant] = false;
                    break;
                }
                results[variant][re] = match;
            }
        }
        for (let variant of Object.keys(results)) {
            if (results[variant])
                return results;
        }
        return false;
    }

    /**
     * Check if input contains everything of search
     * @param {string} locale
     * @param {string} input
     * @param {string} search
     * @return {boolean}
     */
    hasAll(locale, input, search) {
        let inputTokens = this.stem(locale, input);
        let searchTokens = this.stem(locale, search);
        for (let item of searchTokens) {
            if (!inputTokens.includes(item))
                return false;
        }
        return true;
    }

    /**
     * Tokenize and stem
     * @param {string} locale
     * @param {string} input
     * @return {string[]}
     */
    stem(locale, input) {
        if (!locale)
            locale = this._i18n.defaultLocale;
        if (locale === 'ru')
            return natural.PorterStemmerRu.tokenizeAndStem(input);
        return natural.PorterStemmer.tokenizeAndStem(input);
    }
}

module.exports = Commander;
