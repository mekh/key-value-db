module.exports = {
    rabbit: {
        AMQP_URL: process.env.AMPQ_URL,
        INCOME_QUEUE: process.env.INCOME_QUEUE,
        OUTCOME_QUEUE: process.env.OUTCOME_QUEUE,
    },
    db: {
        path: process.env.DB_PATH,
    },
    logger: {
        level: process.env.LOG_LEVEL,
    },
};
