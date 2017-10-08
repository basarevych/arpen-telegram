/**
 * Telegram command handler
 * @module telegram/services/commander
 */
const moment = require('moment-timezone');
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
        this.scenes = new Map();
        this.callbacks = new Map();

        this._priorities = [];
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
    addCommand(command) {
        this.commands.set(command.name, command);

        for (let item of this._priorities) {
            if (item.name === command.name)
                return;
        }

        this._priorities.push({
            name: command.name,
            priority: command.priority,
        });
        this._priorities.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Get command
     * @param {string} name
     * @return {object}
     */
    getCommand(name) {
        return this.commands.get(name);
    }

    /**
     * Add scene
     * @param {object} scene
     */
    addScene(scene) {
        this.scenes.set(scene.name, scene);
    }

    /**
     * Get scene
     * @param {string} name
     * @return {object}
     */
    getScene(name) {
        return this.scenes.get(name);
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

            for (let item of this._priorities) {
                let command = this.getCommand(item.name);
                if (typeof command.process === 'function' && await command.process(this, ctx, scene))
                    return true;
            }
            return false;
        } catch (error) {
            this._logger.error(new NError(error, { ctx }, 'Commander.process()'));
        }
        return false;
    }

    /**
     * Handle menu action
     * @param {object} ctx
     * @param {object} scene
     * @return {Promise}
     */
    async action(ctx, scene) {
        try {
            for (let item of this._priorities) {
                let command = this.getCommand(item.name);
                if (command.name === ctx.match[1] && typeof command.action === 'function')
                    return await command.action(this, ctx, scene);
            }
        } catch (error) {
            this._logger.error(new NError(error, { ctx }, 'Commander.action()'));
        }
    }

    /**
     * Check if input matches syntax
     * @param {string} input
     * @param {object} syntax
     * @return {*}
     */
    match(input, syntax) {
        input = input.toLowerCase();
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
     * Check if input contains anything of search
     * @param {string} locale
     * @param {string} input
     * @param {string} search
     * @return {boolean}
     */
    hasAny(locale, input, search) {
        let inputTokens = this.stem(locale, input);
        let searchTokens = this.stem(locale, search);
        for (let item of searchTokens) {
            if (inputTokens.includes(item))
                return true;
        }
        return false;
    }

    /**
     * Extract date
     * @param {string} locale
     * @param {string} input
     * @return {Promise}
     */
    async extractDate(locale, input) {
        input = input.toLowerCase();
        let result;
        try {
            let dateSyntax, sunday, monday, tuesday, wednesday, thursday, friday, saturday, yesterday, tomorrow, weekEnd;
            if (locale === 'ru') {
                dateSyntax = {
                    iso: {
                        main: /(\d\d\d\d)-(\d\d)-(\d\d)/
                    },
                    long_locale_1: {
                        main: /(\d\d)\.(\d\d)\.(\d\d\d\d)/
                    },
                    long_locale_2: {
                        main: /(\d\d)\/(\d\d)\/(\d\d\d\d)/
                    },
                    short_locale_1: {
                        main: /(\d\d)\.(\d\d)/
                    },
                    short_locale_2: {
                        main: /(\d\d)\/(\d\d)/
                    },
                };
                sunday = 'воскресенье';
                monday = 'понедельник';
                tuesday = 'вторник';
                wednesday = 'среда';
                thursday = 'четверг';
                friday = 'пятница';
                saturday = 'суббота';
                yesterday = 'вчера';
                tomorrow = 'завтра';
                weekEnd = 'конец недели';
            }

            let now = moment();
            let match;
            if (dateSyntax)
                match = this.match(input, dateSyntax);
            if (match) {
                let year, month, day;
                if (match.iso) {
                    year = parseInt(match.iso.main[1]);
                    month = parseInt(match.iso.main[2]);
                    day = parseInt(match.iso.main[3]);
                } else if (match.long_locale_1) {
                    year = parseInt(match.long_locale_1.main[3]);
                    month = parseInt(match.long_locale_1.main[2]);
                    day = parseInt(match.long_locale_1.main[1]);
                } else if (match.long_locale_2) {
                    year = parseInt(match.long_locale_2.main[3]);
                    month = parseInt(match.long_locale_2.main[2]);
                    day = parseInt(match.long_locale_2.main[1]);
                } else if (match.short_locale_1) {
                    year = now.year();
                    month = parseInt(match.short_locale_1.main[2]);
                    day = parseInt(match.short_locale_1.main[1]);
                } else if (match.short_locale_2) {
                    year = now.year();
                    month = parseInt(match.short_locale_2.main[2]);
                    day = parseInt(match.short_locale_2.main[1]);
                }
                if (year && month && day) {
                    if (year < 1000)
                        year += 2000;
                    result = moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} 00:00:00`);
                }
            } else {
                if (sunday && this.hasAll(locale, input, sunday))
                    result = moment().day('Sunday');
                else if (monday && this.hasAll(locale, input, monday))
                    result = moment().day('Monday');
                else if (tuesday && this.hasAll(locale, input, tuesday))
                    result = moment().day('Tuesday');
                else if (wednesday && this.hasAll(locale, input, wednesday))
                    result = moment().day('Wednesday');
                else if (thursday && this.hasAll(locale, input, thursday))
                    result = moment().day('Thursday');
                else if ((friday && this.hasAll(locale, input, friday)) || (weekEnd && this.hasAll(locale, input, weekEnd)))
                    result = moment().day('Friday');
                else if (saturday && this.hasAll(locale, input, saturday))
                    result = moment().day('Saturday');
                else if (yesterday && this.hasAll(locale, input, yesterday))
                    result = now.subtract(1, 'days');
                else if (tomorrow && this.hasAll(locale, input, tomorrow))
                    result = now.add(1, 'days');
            }
        } catch (error) {
            return null;
        }
        return (result && moment.isMoment(result)) ? result : null;
    }

    /**
     * Tokenize and stem
     * @param {string} locale
     * @param {string} input
     * @return {string[]}
     */
    stem(locale, input) {
        input = input.toLowerCase();
        if (!locale)
            locale = this._i18n.defaultLocale;
        if (locale === 'ru')
            return natural.PorterStemmerRu.tokenizeAndStem(input);
        return natural.PorterStemmer.tokenizeAndStem(input);
    }
}

module.exports = Commander;
