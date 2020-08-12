const { Database } = require('./modules/database');
const { Queue } = require('./modules/queue');
const config = require('./config/config');
const logger = require('./modules/logger')({ loglevel: config.logger.level });

/**
 * Init logger, DB, Queue
 */
const log = logger.getLogger('MAIN');

const dbPublicMethods = ['count', 'get', 'set', 'delete'];
const db = new Database({
    dbPath: config.db.path,
    logger: logger.getLogger('DB'),
});

const queue = new Queue({
    url: config.rabbit.AMQP_URL,
    logger: logger.getLogger('QUEUE'),
});

/**
 * Flush the data before exit
 */
const exitHandler = event => {
    log.info(`got '${event}' exit event - flushes the data and exit`);

    if (!db.hasNewData) {
        log.info('No tasks left, exiting');
        process.exit(0);
    }

    db.flushAll().then(() => {
        log.info('All tasks are done, exiting');
        process.exit(0);
    });
};

/**
 * Subscribe on `process` events
 */
['SIGINT', 'SIGTERM']
    .forEach((eventType) => {
        process.on(eventType, exitHandler.bind(null, eventType));
    });

/**
 * Bind outcome queue name
 * @param message
 * @return {Promise<*>}
 */
const send = message => queue.send(config.rabbit.OUTCOME_QUEUE, message);

/**
 * Validate incoming message
 * TODO: this should be changed to ajv or something similar
 * @param msg
 * @return {{error: string}|*}
 */
const validate = msg => {
    const { id, method } = msg;
    if (id === undefined || method === undefined) {
        log.error('Invalid message received', msg);
        return { error: 'Invalid message' };
    }

    if (!dbPublicMethods.includes(method)) {
        const error = `Unknown method: ${method}`;
        log.warn(error);
        return { error };
    }

    return msg;
};

/**
 * Incoming message handler
 * @param request
 * @return {Promise<*>}
 */
const onMessage = async request => {
    log.debug(request);
    const data = validate(request);
    if (data.error) {
        return send({ request, error: data.error });
    }

    const response = await db[data.method](data.params);
    return send({ request, response });
};

/**
 * Subscribe to the incoming queue
 * @return {Promise<void>}
 */
const run = async () => {
    await queue.subscribe(config.rabbit.INCOME_QUEUE, onMessage);
};

/**
 * Run the service
 */
run().then(() => log.info('The service has started successfully'));
