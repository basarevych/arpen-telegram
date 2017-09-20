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
     */
    constructor(app, logger) {
        this._app = app;
        this._logger = logger;

        this.commands = new Map();
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
        return [ 'app', 'logger' ];
    }

    middleware() {
        return (ctx, next) => {
            ctx.commander = {
                process: this.process.bind(this, ctx),
            };
            next(ctx);
        };
    }

    add(command) {
        this.commands.set(command.name, command);
    }

    async process(ctx, scene) {
        try {
            let triggered = null;
            let result = [];
            for (let command of this.commands.values()) {
                for (let variant of command.syntax) {
                    let matches = [];
                    let allMatched = true;
                    for (let re of variant) {
                        let match = re.exec(ctx.message.text);
                        if (!match)
                            allMatched = false;
                        matches.push(match);
                    }
                    if (allMatched) {
                        if (triggered)
                            return false; // multiple match
                        triggered = command;
                        result.push(matches);
                    } else {
                        result.push(false);
                    }
                }
            }
            if (triggered) {
                await triggered.process(ctx, result, scene);
                return true;
            }
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
