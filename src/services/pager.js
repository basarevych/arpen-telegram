/**
 * Telegram pager widget
 * @module telegram/services/pager
 */
const NError = require('nerror');
const { Extra } = require('telegraf');

/**
 * Service class
 */
class Pager {
    /**
     * Create the service
     * @param {App} app                     Application
     * @param {Logger} logger               Logger service
     */
    constructor(app, logger) {
        this._app = app;
        this._logger = logger;
        this._prefix = 'pager';
        this._width = 10;
        this._scenes = new Set();
    }

    /**
     * Service name is 'telegram.services.pager'
     * @type {string}
     */
    static get provides() {
        return 'telegram.services.pager';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'logger' ];
    }

    /**
     * Action prefix setter
     * @param {string} prefix
     */
    set prefix(prefix) {
        this._prefix = prefix;
    }

    /**
     * Action prefix getter
     * @type {string}
     */
    get prefix() {
        return this._prefix;
    }

    /**
     * Pager width setter
     * @param {number} width
     */
    set width(width) {
        this._width = width;
    }

    /**
     * Pager width getter
     * @return {number}
     */
    get width() {
        return this._width;
    }

    /**
     * Search callback setter
     * @param {function} search
     */
    set search(search) {
        this._search = search;
    }

    /**
     * Search callback getter
     * @return {function}
     */
    get search() {
        return this._search;
    }

    /**
     * Send page of data to the chat
     * @param {object} ctx
     * @param {object} scene
     * @param {number} page
     * @param {string} [extra]
     * @return {Promise}
     */
    async sendPage(ctx, scene, page, extra = '') {
        try {
            if (!this.search)
                return;

            this._install(scene);

            let result = await this.search(ctx, scene, page, extra);
            result.offset = Math.ceil(page / this.width);
            ctx.reply(result.message, result.keyboard || this._getMarkup(result, extra));
        } catch (error) {
            this._logger.error(new NError(error, { ctx, scene }, 'Pager.sendPage()'));
        }
    }

    /**
     * Get pager markup
     * @param {object} info
     * @param {string} [extra]
     * @return {*}
     */
    _getMarkup(info, extra) {
        if (info.offset < 1)
            info.offset = 1;

        let maxOffset = Math.ceil(info.totalPages / this.width);
        if (info.offset > maxOffset)
            info.offset = maxOffset;

        return Extra.HTML().markup((m) => {
            let first = [];
            let second = [];
            first.push(m.callbackButton('<<', `${this.prefix}-offset-${info.offset - 1}-${info.pageNumber}-${extra || ''}`));
            for (let i = 0; i < (((info.offset - 1) * this.width + this.width / 2 - 1 < info.totalPages) ? this.width : this.width / 2 - 1); i++) {
                let page = (info.offset - 1) * this.width + i + 1;
                if (i < this.width / 2) {
                    if (page <= info.totalPages) {
                        let label = `${page}`;
                        if (page === info.pageNumber)
                            label = `[${label}]`;
                        first.push(m.callbackButton(label, `${this.prefix}-page-${info.offset}-${page}-${extra || ''}`));
                    } else {
                        first.push(m.callbackButton(' ', `${this.prefix}-ignore`));
                    }
                } else {
                    if (page <= info.totalPages) {
                        let label = `${page}`;
                        if (page === info.pageNumber)
                            label = `[${label}]`;
                        second.push(m.callbackButton(label, `${this.prefix}-page-${info.offset}-${page}-${extra || ''}`));
                    } else {
                        second.push(m.callbackButton(' ', `${this.prefix}-ignore`));
                    }
                }
            }
            second.push(m.callbackButton('>>', `${this.prefix}-offset-${info.offset + 1}-${info.pageNumber}-${extra || ''}`));
            return m.inlineKeyboard(second.length === 1 ? first.concat(second) : [first, second]);
        });
    }

    /**
     * Install action handlers
     * @param {object} scene
     */
    _install(scene) {
        if (this._scenes.has(scene.name))
            return;

        this._scenes.add(scene.name);

        scene.scene.action(new RegExp(`^${this.prefix}-page-([0-9]+)-([0-9]+)-(.*)$`), async ctx => {
            try {
                let offset, page, extra;
                try {
                    offset = parseInt(ctx.match[1]);
                    page = parseInt(ctx.match[2]);
                    if (ctx.match[3])
                        extra = ctx.match[3];
                } catch (error) {
                    return;
                }

                if (this.search) {
                    let result = await this.search(ctx, scene, page, extra);
                    result.offset = offset;
                    return ctx.editMessageText(result.message, result.keyboard || this._getMarkup(result, extra));
                }
            } catch (error) {
                this._logger.error(new NError(error, { ctx }, 'Pager.pageHandler()'));
            }
        });

        scene.scene.action(new RegExp(`^${this.prefix}-offset-([0-9]+)-([0-9]+)-(.*)$`), async ctx => {
            try {
                let offset, page, extra;
                try {
                    offset = parseInt(ctx.match[1]);
                    page = parseInt(ctx.match[2]);
                    if (ctx.match[3])
                        extra = ctx.match[3];
                } catch (error) {
                    return;
                }

                if (this.search) {
                    let result = await this.search(ctx, scene, page, extra);
                    result.offset = offset;
                    result.pageNumber = page;
                    return ctx.editMessageText(ctx.callbackQuery.message.text, result.keyboard || this._getMarkup(result, extra));
                }
            } catch (error) {
                this._logger.error(new NError(error, { ctx }, 'Pager.offsetHandler()'));
            }
        });

        scene.scene.action(`${this.prefix}-ignore`, () => {});
    }
}

module.exports = Pager;
