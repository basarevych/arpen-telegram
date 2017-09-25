/**
 * Telegram command handler
 * @module telegram/services/commander
 */
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
     */
    constructor(app, logger, util) {
        this._app = app;
        this._logger = logger;
        this._util = util;

        this.commands = new Map();
        this.callbacks = new Map();
    }

    /**
     * Service name is 'commander'
     * @type {string}
     */
    static get provides() {
        return 'commander';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'logger', 'util' ];
    }

    middleware() {
        return (ctx, next) => {
            ctx.commander = {
                process: this.process.bind(this, ctx),
            };
            return next(ctx);
        };
    }

    add(command) {
        this.commands.set(command.name, command);
    }

    setCallback(ctx, cb) {
        let id = this._util.getRandomString(32);
        ctx.session.callback = id;
        this.callbacks.set(id, cb);
    }

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

            let triggered = null;
            let match = null;
            for (let command of this.commands.values()) {
                let result = [];
                let variantMatched = false;
                for (let variant of command.syntax) {
                    let reMatches = [];
                    let allMatched = true;
                    for (let re of variant) {
                        let match = re.exec(ctx.message.text);
                        if (!match)
                            allMatched = false;
                        reMatches.push(match);
                    }
                    if (allMatched) {
                        variantMatched = true;
                        result.push(reMatches);
                    } else {
                        result.push(false);
                    }
                }
                if (variantMatched) {
                    if (triggered)
                        return false; // multiple match
                    triggered = command;
                }
                if (triggered && !match)
                    match = result; // triggered command results
            }
            if (triggered)
                return await triggered.process(this, ctx, match, scene);
        } catch (error) {
            try {
                this._logger.error(new NError(error, 'Commander.process()'));
                await ctx.replyWithHTML(
                    `<i>Произошла ошибка. Пожалуйста, попробуйте повторить позднее.</i>`,
                    Markup.removeKeyboard().extra()
                );
            } catch (error) {
                // do nothing
            }
        }
        return false;
    }
}

module.exports = Commander;
