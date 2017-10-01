/**
 * Telegram calendar widget
 * @module telegram/services/calendar
 */
const NError = require('nerror');
const { Markup, Extra } = require('telegraf');

/**
 * Service class
 */
class Calendar {
    /**
     * Create the service
     * @param {App} app                     Application
     * @param {Logger} logger               Logger service
     * @param {object} options              Options
     */
    constructor(app, logger, options) {
        this._app = app;
        this._logger = logger;
        this._prefix = 'calendar';

        this.options = Object.assign(
            {
                startWeekDay: 0,
                weekDayNames: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
                monthNames: [
                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                ],
                minDate: null,
                maxDate: null
            },
            options
        );
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
     *
     * @param {*Date} myDate input date
     * @param {*Date} testDate test date
     *
     * @returns bool
     */
    static isSameMonth(myDate, testDate) {
        if (!myDate) return false;

        testDate = testDate || new Date();

        return myDate.getFullYear() === testDate.getFullYear() && myDate.getMonth() === testDate.getMonth();
    }

    /**
     * This uses unicode to draw strikethrough on text
     * @param {*String} text text to modify
     */
    static strikethroughText(text) {
        return text.split('').reduce(function (acc, char) {
            return acc + char + '\u0336';
        }, '');
    }

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
     * Bot setter
     * @param {object} bot
     */
    set bot(bot) {
        this._bot = bot;
    }

    /**
     * Bot getter
     * @type {object}
     */
    get bot() {
        return this._bot;
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
     * @param {function} search
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
     * Install action handlers
     * @param {object} [bot]
     */
    install(bot) {
        if (bot)
            this.bot = bot;

        this.bot.action(new RegExp(`^${this.prefix}-date-([-0-9]+)$`), async ctx => {
            try {
                let date;
                try {
                    date = ctx.match[1];
                } catch (error) {
                    return;
                }

                if (this.handler)
                    await this.handler(ctx, date);
            } catch (error) {
                try {
                    this._logger.error(new NError(error, 'Calendar.dateHandler()'));
                    await ctx.replyWithHTML(
                        `<i>Произошла ошибка. Пожалуйста, попробуйте повторить позднее.</i>`,
                        Markup.removeKeyboard().extra()
                    );
                } catch (error) {
                    // do nothing
                }
            }
        });

        this.bot.action(new RegExp(`^${this.prefix}-prev-([-0-9]+)$`), async ctx => {
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
                ctx.editMessageText(prevText, this._getMarkup(date));
            } catch (error) {
                try {
                    this._logger.error(new NError(error, 'Calendar.prevHandler()'));
                    await ctx.replyWithHTML(
                        `<i>Произошла ошибка. Пожалуйста, попробуйте повторить позднее.</i>`,
                        Markup.removeKeyboard().extra()
                    );
                } catch (error) {
                    // do nothing
                }
            }
        });

        this.bot.action(new RegExp(`^${this.prefix}-next-([-0-9]+)$`), async ctx => {
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
                ctx.editMessageText(prevText, this._getMarkup(date));
            } catch (error) {
                try {
                    this._logger.error(new NError(error, 'Calendar.nextHandler()'));
                    await ctx.replyWithHTML(
                        `<i>Произошла ошибка. Пожалуйста, попробуйте повторить позднее.</i>`,
                        Markup.removeKeyboard().extra()
                    );
                } catch (error) {
                    // do nothing
                }
            }
        });

        this.bot.action(`${this.prefix}-ignore`, () => {});
    }

    /**
     * Return Calendar Markup
     */
    getCalendar() {
        return this._getMarkup(new Date());
    }

    setMinDate(date) {
        this.options.minDate = date;
    }

    setMaxDate(date) {
        this.options.maxDate = date;
    }

    _getMarkup(date) {
        return Extra.HTML().markup((m) => {
            return m.inlineKeyboard(this._getPage(m, date));
        });
    }

    _getPage(m, date) {
        let page = [];
        this._addHeader(page, m, date);
        this._addDays(page, m, date);
        return page;
    }

    _addHeader(page, m, date) {
        let monthName = this.options.monthNames[date.getMonth()];
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

        page.push(this.options.weekDayNames.map(e => m.callbackButton(e, `${this.prefix}-ignore`)));
    }

    _addDays(page, m, date) {
        let maxMonthDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        let maxDay = this._getMaxDay(date);
        let minDay = this._getMinDay(date);

        let currentRow = new Array(7).fill(m.callbackButton(' ', `${this.prefix}-ignore`));
        for (var d = 1; d <= maxMonthDay; d++) {
            date.setDate(d);

            let weekDay = this._normalizeWeekDay(date.getDay());
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

    _normalizeWeekDay(weekDay) {
        let result = weekDay - this.options.startWeekDay;
        if (result < 0) result += 7;
        return result;
    }

    /**
     * Calculates min day depending on input date and minDate in options
     *
     * @param {*Date} date Test date
     *
     * @returns int
     */
    _getMinDay(date) {
        let minDay;
        if (this._isInMinMonth(date))
            minDay = this.options.minDate.getDate();
        else
            minDay = 1;

        return minDay;
    }

    /**
     * Calculates max day depending on input date and maxDate in options
     *
     * @param {*Date} date Test date
     *
     * @returns int
     */
    _getMaxDay(date) {
        let maxDay;
        if (this._isInMaxMonth(date))
            maxDay = this.options.maxDate.getDate();
        else
            maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

        return maxDay;
    }

    /**
     * Check if inupt date is in same year and month as min date
     */
    _isInMinMonth(date) {
        return this.constructor.isSameMonth(this.options.minDate, date);
    }

    /**
     * Check if inupt date is in same year and month as max date
     */
    _isInMaxMonth(date) {
        return this.constructor.isSameMonth(this.options.maxDate, date);
    }
}

module.exports = Calendar;
