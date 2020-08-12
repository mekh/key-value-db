/* eslint-disable no-underscore-dangle,class-methods-use-this */
const fs = require('fs');
const path = require('path');
const dummyLogger = require('./dummyLogger');
const { serialize, deSerialize, listDir, writeFile } = require('../utils');

/**
 * Key-value storage
 */
class Database {
    constructor({ dbPath, logger }) {
        this.logger = logger || dummyLogger;
        this.ready = false;
        this.hasNewData = false;
        this.data = []; // the data received from a persistent storage
        this.cache = []; // the data received on runtime
        this.dbPath = dbPath;
        this.fileName = '0001.log';
        this.delimeterRecord = ';;';
        this.delimeterKeyValue = ':';
        this.flushInterval = 10000;

        this._init()
            .then(() => {
                this.logger.info('Init successfully');
            });
    }

    /**
     * Format data before it flushed
     * @param {Object[]} data
     * @return {string}
     * @private
     */
    _prepareDataForFlush(data) {
        if (!data || data.length === 0) {
            return '';
        }

        return data.reduce(
            (acc, { key, value }) => `${acc}${this.delimeterRecord}${key}:${serialize(value)}`,
            '',
        );
    }

    /**
     * Extract a key from a given string
     * @param {string} str
     * @return {string}
     * @private
     */
    _getKey(str) {
        return str.split(this.delimeterKeyValue)[0];
    }

    /**
     * Extract a value from a given string
     * @param {string} str
     * @param {string} key
     * @return {string}
     * @private
     */
    _getValue(str, key) {
        return str.replace(`${key}${this.delimeterKeyValue}`, '');
    }

    /**
     * Find a record by key
     * @param {string} key
     * @param {Object[]} collection
     * @return {Object|undefined}
     * @private
     */
    _findRecord(key, collection) {
        return collection.find(doc => doc.key === key);
    }

    /**
     * Get record index within a given collection
     * @param {string} key
     * @param {Object[]} collection
     * @return {number}
     * @private
     */
    _getRecordIndex(key, collection) {
        return collection.findIndex(doc => doc.key === key);
    }

    /**
     * Format key
     * @param {string|number} key
     * @return {string}
     * @private
     */
    _normalizeKey(key) {
        if (!['string', 'number'].includes(typeof key)) {
            throw new Error('Key must be a string or number');
        }

        // TODO: make it possible to use different type of keys (string, number, etc.) by adding some prefixes
        const _key = String(key);

        if (_key.includes(this.delimeterKeyValue)) {
            throw new Error(`A key should not contain "${this.delimeterKeyValue}" symbol`);
        }

        return _key;
    }

    /**
     * Parse data obtained from a log file
     * @param {string} data
     * @return {{value: any | undefined, key: string}[]}
     * @private
     */
    _parseLogFile(data) {
        return data
            .split(this.delimeterRecord)
            .map(str => {
                const key = this._getKey(str);
                const value = deSerialize(this._getValue(str, key));

                return { key, value };
            })
            .filter(({ key, value }) => (key !== '' && value !== ''));
    }

    /**
     * Read a log file
     * @param {string} logPath - path to a file
     * @return {Promise<string>}
     * @private
     */
    async _readLogFile(logPath) {
        this.logger.trace(`Reading file ${logPath}`);

        const stream = fs.createReadStream(logPath);
        let data = '';

        stream.on('data', chunk => {
            data += chunk.toString();
        });

        return new Promise(resolve => {
            stream.on('end', () => {
                this.logger.trace(`File has been read successfully ${logPath}`);
                resolve(data);
            });
        });
    }

    /**
     * Write a log file
     * @param {string} logPath
     * @param {string} data
     * @param {boolean=false} append
     * @return {Promise<void>}
     * @private
     */
    async _writeLogFile(logPath, data, append = false) {
        this.logger.trace(`Writing log file ${logPath}`);

        return writeFile(logPath, data, { flag: append ? 'a' : 'w' })
            .then(() => this.logger.debug(`File has been written ${logPath}`))
            .catch(err => {
                this.logger.error(`Failed to write file ${logPath}: ${err}`);
                throw err;
            });
    }

    /**
     * Block the thread until ready
     * @return {Promise<void>}
     * @private
     */
    async _waitReadiness() {
        while (!this.ready) {
            this.logger.trace('DB is not ready yet, waiting...');
            // eslint-disable-next-line no-await-in-loop
            await new Promise(setImmediate);
        }
    }

    /**
     * Read log files, parse them and load to memory
     * @return {Promise<void>}
     * @private
     */
    async _init() {
        if (!fs.existsSync(this.dbPath)) {
            fs.mkdirSync(this.dbPath, { recursive: true });
        }

        let list = [];

        try {
            list = await listDir(this.dbPath, { withFileTypes: true });
        } catch (e) {
            throw new Error(`failed to read a dir content (${this.dbPath}): ${e.message}`);
        }

        const files = list.filter(item => !item.isDirectory()).map(item => item.name);

        return Promise
            .all(files.map(file => this._readLogFile(path.join(this.dbPath, file))))
            .then(data => {
                this.data = data.flatMap(this._parseLogFile.bind(this));
                this.ready = true;

                this.logger.trace(`Init done, the number of records: ${this.data.length}`);
            })
            .then(() => {
                setInterval(() => {
                    if (this.hasNewData) {
                        this.hasNewData = false;
                        this.flushAll();
                    }
                }, this.flushInterval);
            });
    }

    /**
     * Remove a doc from a given collection
     * @param {string} key
     * @param {Object[]} collection
     * @return {Object[]}
     * @private
     */
    _removeDoc(key, collection) {
        if (!collection || collection.length === 0) {
            return collection;
        }

        const _collection = [...collection];
        const _key = this._normalizeKey(key);
        const docIdx = this._getRecordIndex(_key, _collection);
        if (docIdx > -1) {
            _collection.splice(docIdx, 1);
        }

        return _collection;
    }

    /**
     * Flush data to fs
     * @param {object[]} data
     * @param {boolean=false} append
     * @return {Promise<void>}
     * @private
     */
    async _flush(data, append = false) {
        await this._waitReadiness();

        this.ready = false;

        const formattedData = this._prepareDataForFlush(data);
        const writePath = path.join(this.dbPath, this.fileName);

        await this._writeLogFile(writePath, formattedData, append);

        this.ready = true;
    }

    /**
     * Flush cache
     * @return {Promise<void>}
     * @private
     */
    async _flushCache() {
        await this._flush(this.cache, true);

        this.data = [...this.data, ...this.cache];
        this.cache = [];
    }

    /**
     * Flush data
     * @return {Promise<void>}
     * @private
     */
    async _flushData() {
        return this._flush(this.data, false);
    }

    /**
     * Public methods
     */

    /**
     * Flush cache and data
     * @return {Promise<void>}
     */
    async flushAll() {
        await this._flushData();
        await this._flushCache();
    }

    /**
     * Get the number of records
     * @return {Promise<number>}
     */
    async count() {
        await this._waitReadiness();
        return this.data.length + this.cache.length;
    }

    /**
     * Insert or update a record
     * @param {string|number} key
     * @param value
     * @return {Promise<Object>}
     */
    async set({ key, value }) {
        await this._waitReadiness();

        const _key = this._normalizeKey(key);
        const doc = { key: _key, value };
        let docIdx = this._getRecordIndex(_key, this.cache);

        if (docIdx !== -1) {
            // There is a cached doc, update it
            this.cache[docIdx] = doc;
        } else {
            // There is no doc in a cache, try to find and update it in the data array
            docIdx = this._getRecordIndex(_key, this.data);

            if (docIdx !== -1) {
                // Update the doc
                this.data[docIdx] = doc;
            } else {
                // Put a new doc to the cache
                this.cache.push(doc);
            }
        }

        this.hasNewData = true;

        return { [_key]: value };
    }

    /**
     * Get a record by key
     * @param {string|number} key
     * @return {Promise<{}>}
     */
    async get({ key }) {
        await this._waitReadiness();

        const _key = this._normalizeKey(key);
        const doc = this._findRecord(_key, this.cache) || this._findRecord(_key, this.data);

        if (doc) {
            return { [doc.key]: deSerialize(doc.value) };
        }

        return null;
    }

    /**
     * Delete record
     * @param {string|number} key
     * @return {Promise<boolean>}
     */
    async delete({ key }) {
        await this._waitReadiness();

        this.cache = this._removeDoc(key, this.cache);
        this.data = this._removeDoc(key, this.data);

        this.hasNewData = true;

        return true;
    }
}

module.exports = {
    Database,
};
