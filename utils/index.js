const fs = require('fs');

/**
 * Serialize an object
 * @param {any} data
 * @return {string|*}
 */
const serialize = data => {
    try {
        return JSON.stringify(data);
    } catch (e) {
        return data;
    }
};

/**
 * Parse string, try to convert it to Object
 * @param {any} data
 * @return {any}
 */
const deSerialize = data => {
    try {
        return JSON.parse(data);
    } catch (e) {
        return data;
    }
};

/**
 * Promisify fs.readFile
 * @param {string} filePath - path to a file
 * @param {("ascii" | "utf8" | "utf-8" | "utf16le" | "ucs2" | "ucs-2" | "base64" | "latin1" | "binary" | "hex" )} [encoding]
 *      file encoding, default is 'utf-8'
 */
const readFile = (filePath, encoding = 'utf-8') => new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, body) => {
        if (err) {
            return reject(err);
        }

        resolve(body.toString(encoding));
    });
});

/**
 * Promisify fs.writeFile
 * @param {string|Buffer|URL|number} file - filename or file descriptor
 * @param {string|Buffer} data - data to be written
 * @param {Object|string} options - fs.writeFile options
 */
const writeFile = (file, data, options = {}) => new Promise((resolve, reject) => {
    fs.writeFile(file, data, options, err => {
        if (err) {
            reject(err);
        }
        resolve();
    });
});

/**
 * Promisify fs.readdir
 * @param {string} dirPath - a path to be listed
 * @param {object} options - fs.readdir options
 */
const listDir = (dirPath, options = {}) => new Promise((resolve, reject) => {
    fs.readdir(dirPath, options, (err, content) => {
        if (err) {
            return reject(err);
        }

        resolve(content);
    });
});

module.exports = {
    serialize,
    deSerialize,
    listDir,
    readFile,
    writeFile,
};
