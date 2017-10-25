/**
 * Telegram session bridge service
 * @module telegram/services/telegram-session
 */

/**
 * Telegram session bridge service
 */
class TelegramSession {
    /**
     * Create the service
     * @param {App} app                         The application
     * @param {object} config                   Configuration
     * @param {Logger} logger                   Logger service
     * @param {string} server                   Server name
     */
    constructor(app, config, logger, server) {
        this.server = server;

        this._app = app;
        this._config = config;
        this._logger = logger;

        let sessionRepo = this._config.get(`servers.${server}.session.session_repository`);
        if (sessionRepo)
            this._sessionRepo = this._app.get(sessionRepo);

        let userRepo = this._config.get(`servers.${server}.session.user_repository`);
        if (userRepo)
            this._userRepo = this._app.get(userRepo);
    }

    /**
     * Service name is 'telegramSession'
     * @type {string}
     */
    static get provides() {
        return 'telegramSession';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [
            'app',
            'config',
            'logger',
        ];
    }

    /**
     * Combine and delay write operations, seconds
     * @type {number}
     */
    get saveInterval() {
        return this._config.get(`servers.${this.server}.session.save_interval`) || 0;
    }

    /**
     * Expiration timeout, seconds
     * @type {number}
     */
    get expirationTimeout() {
        return this._config.get(`servers.${this.server}.session.expire_timeout`) || 0;
    }

    /**
     * Expiration scan interval, seconds
     * @type {number}
     */
    get expirationInterval() {
        return this._config.get(`servers.${this.server}.session.expire_interval`) || 0;
    }

    /**
     * Create session model
     * @param {UserModel|null} user                 User model or null for anonymous session
     * @param {*} from                              Telegram from object
     * @return {Promise}                            Resolves to session model
     */
    async create(user, from) {
        let model = this._config.get(`servers.${this.server}.session.model`);
        let session;
        if (model)
            session = this._app.get(model);
        else if (this._sessionRepo)
            session = this._sessionRepo.getModel();
        else
            throw new Error('No model for the bridge');

        if (!from || !from.id)
            throw new Error('Invalid "from" data');

        session.telegramId = from.id.toString();
        session.payload = {};
        session.info = from;
        session.user = user;
        if (user)
            session.userId = user.id;
        return session;
    }

    /**
     * Find session model
     * @param {string} telegramId                   Telegram ID
     * @param {*} from                              Telegram from object
     * @return {Promise}                            Resolves to session model or null
     */
    async find(telegramId, from) {
        if (!this._sessionRepo)
            return null;

        let sessions = await this._sessionRepo.findByTelegramId(telegramId.toString());
        let session = sessions.length && sessions[0];
        if (!session)
            return null;

        if (session.userId && this._userRepo) {
            let users = await this._userRepo.find(session.userId);
            session.user = (users.length && users[0]) || null;
        }

        session.info = from;

        return session;
    }

    /**
     * Save session model
     * @param {SessionModel} session                Session model
     * @param {*} from                              Telegram from object
     * @return {Promise}
     */
    async save(session, from) {
        session.info = from;
        session.userId = session.user ? session.user.id : null;
        if (this._sessionRepo)
            await this._sessionRepo.save(session);
    }

    /**
     * Delete session model
     * @param {SessionModel} session                Session model
     * @return {Promise}
     */
    async destroy(session) {
        if (this._sessionRepo)
            await this._sessionRepo.delete(session);
    }

    /**
     * Delete expired session models
     * @return {Promise}
     */
    async expire() {
        if (this._sessionRepo && this._sessionRepo.deleteExpired)
            await this._sessionRepo.deleteExpired(this.expirationTimeout);
    }
}

module.exports = TelegramSession;
