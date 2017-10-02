/**
 * Stem command
 * @module commands/stem
 */
const argvParser = require('argv');

/**
 * Command to print stemmed tokens
 */
class Stem {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     * @param {Util} util               Utility service
     * @param {Commander} commander     Commander service
     */
    constructor(app, config, util, commander) {
        this._app = app;
        this._config = config;
        this._util = util;
        this._commander = commander;
    }

    /**
     * Service name is 'commands.stem'
     * @type {string}
     */
    static get provides() {
        return 'commands.stem';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'util', 'telegram.services.commander' ];
    }

    /**
     * Run the command
     * @param {string[]} argv           Arguments
     * @return {Promise}
     */
    async run(argv) {
        let args = argvParser
            .option({
                name: 'help',
                short: 'h',
                type: 'boolean',
            })
            .run(argv);

        if (args.targets.length < 3)
            return this.error('Need locale and input');

        await this._app.info(this._commander.stem(args.targets[1], args.targets[2]));
    }

    /**
     * Log error and terminate
     * @param {...*} args
     * @return {Promise}
     */
    async error(...args) {
        try {
            await args.reduce(
                async (prev, cur) => {
                    await prev;
                    return this._app.error(cur.fullStack || cur.stack || cur.message || cur);
                },
                Promise.resolve()
            );
        } catch (error) {
            // do nothing
        }
        process.exit(1);
    }
}

module.exports = Stem;
