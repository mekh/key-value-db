const amqp = require('amqplib');
const dummyLogger = require('./dummyLogger');
const { serialize, deSerialize } = require('../utils');

class Queue {
    constructor({ url, logger, options = {} }) {
        this.url = url;
        this.logger = logger || dummyLogger;
        this.options = options;
        this.channel = null;
    }

    /**
     * Connect
     * @return {Promise<void>}
     */
    async connect() {
        const connection = await amqp.connect(this.url, this.options);
        this.channel = await connection.createChannel();
        this.logger.info('Connection established');
    }

    /**
     * Subscribe to queue
     * @param {string} queue
     * @param {function} callback
     */
    async subscribe(queue, callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (this.channel === null) {
            await this.connect();
        }

        await this.channel.assertQueue(queue);
        return this.channel.consume(queue, msg => {
            if (msg !== null) {
                const data = deSerialize(msg.content.toString());
                this.logger.debug(`=> [IN] [${queue}]`, data);
                callback(data);
                this.channel.ack(msg);
            }
        });
    }

    /**
     * Send to a queue
     * @param {string} queue
     * @param {*} data
     * @return {Promise<*>}
     */
    async send(queue, data) {
        if (this.channel === null) {
            await this.connect();
        }

        const msg = serialize(data);

        await this.channel.assertQueue(queue);
        const result = this.channel.sendToQueue(queue, Buffer.from(msg));

        this.logger.debug(`<= [OUT] [${queue}]`, data);
        return result;
    }
}

module.exports = {
    Queue,
};
