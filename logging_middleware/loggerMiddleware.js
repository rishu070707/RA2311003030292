const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, 'service_execution.log');

const systemLogger = {
    info: (msg, details = {}) => {
        const entry = `[INFO] ${new Date().toISOString()} - ${msg} - ${JSON.stringify(details)}\n`;
        fs.appendFileSync(logFilePath, entry);
    },
    error: (msg, err = {}) => {
        const entry = `[ERROR] ${new Date().toISOString()} - ${msg} - ${JSON.stringify(err)}\n`;
        fs.appendFileSync(logFilePath, entry);
    },
    warn: (msg, details = {}) => {
        const entry = `[WARN] ${new Date().toISOString()} - ${msg} - ${JSON.stringify(details)}\n`;
        fs.appendFileSync(logFilePath, entry);
    }
};

const activityTrackerMiddleware = (req, res, next) => {
    systemLogger.info('Incoming request received', {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress
    });

    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        systemLogger.info('Request fulfilled', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            timeMs: duration
        });
    });

    next();
};

module.exports = { activityTrackerMiddleware, systemLogger };
