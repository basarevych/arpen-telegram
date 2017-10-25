/**
 * Session middleware
 * @module telegram/middleware/session
 */

/**
 * Local session
 */
class Session {
    /**
     * Create the service
     * @param {App} app                         The application
     * @param {object} config                   Configuration
     * @param {Logger} logger                   Logger service
     * @param {Session} session                 Session service
     */
    constructor(app, config, logger, session) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._session = session;
    }

    /**
     * Service name is 'telegram.session'
     * @type {string}
     */
    static get provides() {
        return 'telegram.session';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'session' ];
    }

    /**
     * Register middleware
     * @param {Telegram} server         The server
     * @return {Promise}
     */
    async register(server) {
        let config = this._config.get(`servers.${server.name}.session`);
        if (!config)
            return;

        let bridge = this._app.get(config.bridge, server.name);
        await this._session.addBridge(server.name, bridge);

        server.bot.use(async (ctx, next) => {
            ctx.session = {};
            ctx.user = null;

            let session;
            try {
                session = await this._session.load(server.name, ctx.from.id.toString(), ctx.from);
                if (!session)
                    session = await this._session.create(server.name, null, ctx.from);
                Object.assign(ctx.session, session.payload);
                ctx.user = (session && session.user) || null;
            } catch (error) {
                this._logger.error(error);
            }

            return next()
                .then(async () => {
                    if (session) {
                        session.payload = ctx.session;
                        session.user = ctx.user;

                        try {
                            await this._session.update(server.name, session, ctx.from);
                        } catch (error) {
                            this._logger.error(error);
                        }
                    }
                });
        });
    }

    /**
     * Unregister middleware
     * @param {Express} server          The server
     * @return {Promise}
     */
    async unregister(server) {
        let config = this._config.get(`servers.${server.name}.session`);
        if (!config)
            return;

        await this._session.removeBridge(server.name);
    }
}

module.exports = Session;
