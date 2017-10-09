/**
 * Telegram calendar widget
 * @module telegram/services/calendar
 */
const NError = require('nerror');
const { Extra } = require('telegraf');

/**
 * Service class
 */
class Calendar {
    /**
     * Create the service
     * @param {App} app                     Application
     * @param {Logger} logger               Logger service
     */
    constructor(app, logger) {
        this._app = app;
        this._logger = logger;
        this._prefix = 'calendar';
        this._minDate = null;
        this._maxDate = null;
        this._scenes = new Set();
    }

    /**
     * Service name is 'telegram.services.calendar'
     * @type {string}
     */
    static get provides() {
        return 'telegram.services.calendar';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'logger' ];
    }

    /**
     * Check if myDate is in same year and month as testDate
     * @param {Date} myDate input date
     * @param {Date} testDate test date
     * @return {boolean}
     */
    static isSameMonth(myDate, testDate) {
        if (!myDate) return false;

        testDate = testDate || new Date();

        return myDate.getFullYear() === testDate.getFullYear() && myDate.getMonth() === testDate.getMonth();
    }

    /**
     * This uses unicode to draw strikethrough on text
     * @param {string} text text to modify
     * @return {string}
     */
    static strikethroughText(text) {
        return text.split('').reduce(function (acc, char) {
            return acc + char + '\u0336';
        }, '');
    }

    /**
     * Format date string
     * @param {date} date
     * @return {string}
     */
    static toYyyymmdd(date) {
        let mm = date.getMonth() + 1; // getMonth() is zero-based
        let dd = date.getDate();

        return [
            date.getFullYear(),
            (mm > 9 ? '' : '0') + mm,
            (dd > 9 ? '' : '0') + dd
        ].join('-');
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
     * Handler callback setter
     * @param {function} handler
     */
    set handler(handler) {
        this._handler = handler;
    }

    /**
     * Handler callback getter
     * @return {function}
     */
    get handler() {
        return this._handler;
    }

    /**
     * Get options
     * @param {object} ctx
     * @return {object}
     */
    getOptions(ctx) {
        return {
            startWeekDay: parseInt(ctx.i18n('start_week_day')),
            weekDayNames: [
                ctx.i18n('sunday_short'),
                ctx.i18n('monday_short'),
                ctx.i18n('tuesday_short'),
                ctx.i18n('wednesday_short'),
                ctx.i18n('thursday_short'),
                ctx.i18n('friday_short'),
                ctx.i18n('saturday_short'),
            ],
            monthNames: [
                ctx.i18n('january_short'),
                ctx.i18n('february_short'),
                ctx.i18n('march_short'),
                ctx.i18n('april_short'),
                ctx.i18n('may_short'),
                ctx.i18n('june_short'),
                ctx.i18n('july_short'),
                ctx.i18n('august_short'),
                ctx.i18n('september_short'),
                ctx.i18n('october_short'),
                ctx.i18n('november_short'),
                ctx.i18n('december_short'),
            ],
        };
    }

    /**
     * Return Calendar Markup
     * @param {object} ctx
     * @param {object} scene
     * @return {object}
     */
    getCalendar(ctx, scene) {
        try {
            if (!this.handler)
                return;

            this._install(scene);

            return this._getMarkup(ctx, new Date());
        } catch (error) {
            this._logger.error(new NError(error, { ctx, scene }, 'Calendar.getCalendar()'));
        }
    }

    /**
     * No dates before this
     * @param {Date} date
     */
    setMinDate(date) {
        this._minDate = date;
    }

    /**
     * No dates after this
     * @param {Date} date
     */
    setMaxDate(date) {
        this._maxDate = date;
    }

    /**
     * Retrieve markup
     * @param {object} ctx
     * @param {Date} date
     * @return {object}
     */
    _getMarkup(ctx, date) {
        return Extra.HTML().markup((m) => {
            return m.inlineKeyboard(this._getPage(ctx, m, date));
        });
    }

    /**
     * Page of calendar
     * @param {object} ctx
     * @param {object} m
     * @param {Date} date
     * @return {Array}
     */
    _getPage(ctx, m, date) {
        let page = [];
        this._addHeader(ctx, page, m, date);
        this._addDays(ctx, page, m, date);
        return page;
    }

    /**
     * Header of calendar
     * @param {object} ctx
     * @param {Array} page
     * @param {object} m
     * @param {Date} date
     */
    _addHeader(ctx, page, m, date) {
        let monthName = this.getOptions(ctx).monthNames[date.getMonth()];
        let year = date.getFullYear();

        let header = [];

        if (this._isInMinMonth(date))
            header.push(m.callbackButton(' ', `${this.prefix}-ignore`)); // this is min month, I push an empty button
        else
            header.push(m.callbackButton('<', `${this.prefix}-prev-${this.constructor.toYyyymmdd(date)}`));

        header.push(m.callbackButton(monthName + ' ' + year, `${this.prefix}-ignore`));

        if (this._isInMaxMonth(date))
            header.push(m.callbackButton(' ', `${this.prefix}-ignore`)); // this is max month, I push an empty button
        else
            header.push(m.callbackButton('>', `${this.prefix}-next-${this.constructor.toYyyymmdd(date)}`));

        page.push(header);

        page.push(this.getOptions(ctx).weekDayNames.map(e => m.callbackButton(e, `${this.prefix}-ignore`)));
    }

    /**
     * Body of calendar
     * @param {object} ctx
     * @param {Array} page
     * @param {object} m
     * @param {Date} date
     */
    _addDays(ctx, page, m, date) {
        let maxMonthDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        let maxDay = this._getMaxDay(date);
        let minDay = this._getMinDay(date);

        let currentRow = new Array(7).fill(m.callbackButton(' ', `${this.prefix}-ignore`));
        for (var d = 1; d <= maxMonthDay; d++) {
            date.setDate(d);

            let weekDay = this._normalizeWeekDay(ctx, date.getDay());
            // currentRow[weekDay] = CalendarHelper.toYyyymmdd(date);
            if (d < minDay || d > maxDay)
                currentRow[weekDay] = m.callbackButton(this.constructor.strikethroughText(d.toString()), `${this.prefix}-ignore`);
            else
                currentRow[weekDay] = m.callbackButton(d.toString(), `${this.prefix}-date-${this.constructor.toYyyymmdd(date)}`);

            if (weekDay === 6 || d === maxMonthDay) {
                page.push(currentRow);
                currentRow = new Array(7).fill(m.callbackButton(' ', `${this.prefix}-ignore`));
            }
        }
    }

    /**
     * Normalize week day
     * @param {object} ctx
     * @param {number} weekDay
     * @return {number}
     */
    _normalizeWeekDay(ctx, weekDay) {
        let result = weekDay - this.getOptions(ctx).startWeekDay;
        if (result < 0) result += 7;
        return result;
    }

    /**
     * Calculates min day depending on input date and minDate in options
     * @param {Date} date Test date
     * @return int
     */
    _getMinDay(date) {
        let minDay;
        if (this._isInMinMonth(date))
            minDay = this._minDate.getDate();
        else
            minDay = 1;

        return minDay;
    }

    /**
     * Calculates max day depending on input date and maxDate in options
     * @param {Date} date Test date
     * @return int
     */
    _getMaxDay(date) {
        let maxDay;
        if (this._isInMaxMonth(date))
            maxDay = this._maxDate.getDate();
        else
            maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

        return maxDay;
    }

    /**
     * Check if input date is in same year and month as min date
     */
    _isInMinMonth(date) {
        return this.constructor.isSameMonth(this._minDate, date);
    }

    /**
     * Check if input date is in same year and month as max date
     */
    _isInMaxMonth(date) {
        return this.constructor.isSameMonth(this._maxDate, date);
    }

    /**
     * Install action handlers
     * @param {object} scene
     */
    _install(scene) {
        if (this._scenes.has(scene.name))
            return;

        this._scenes.add(scene.name);

        scene.scene.action(new RegExp(`^${this.prefix}-date-([-0-9]+)$`), async ctx => {
            try {
                let date;
                try {
                    date = ctx.match[1];
                } catch (error) {
                    return;
                }

                if (this.handler)
                    await this.handler(ctx, scene, date);
            } catch (error) {
                this._logger.error(new NError(error, { ctx }, 'Calendar.dateHandler()'));
            }
        });

        scene.scene.action(new RegExp(`^${this.prefix}-prev-([-0-9]+)$`), async ctx => {
            try {
                let dateString;
                try {
                    dateString = ctx.match[1];
                } catch (error) {
                    return;
                }

                let date = new Date(dateString);
                date.setMonth(date.getMonth() - 1);

                let prevText = ctx.callbackQuery.message.text;
                ctx.editMessageText(prevText, this._getMarkup(ctx, date));
            } catch (error) {
                this._logger.error(new NError(error, { ctx }, 'Calendar.prevHandler()'));
            }
        });

        scene.scene.action(new RegExp(`^${this.prefix}-next-([-0-9]+)$`), async ctx => {
            try {
                let dateString;
                try {
                    dateString = ctx.match[1];
                } catch (error) {
                    return;
                }

                let date = new Date(dateString);
                date.setMonth(date.getMonth() + 1);

                let prevText = ctx.callbackQuery.message.text;
                ctx.editMessageText(prevText, this._getMarkup(ctx, date));
            } catch (error) {
                this._logger.error(new NError(error, { ctx }, 'Calendar.nextHandler()'));
            }
        });

        scene.scene.action(`${this.prefix}-ignore`, () => {});
    }
}

module.exports = Calendar;
