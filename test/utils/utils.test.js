const fs = require('fs');
const utils = require('../../utils');

jest.mock('path');

describe('# Utils - fsUtils', () => {
    describe('readFile', () => {
        it('should read a file', async () => {
            const params = 'a';
            const spyFs = jest.spyOn(fs, 'readFile').mockImplementation((data, cb) => cb(null, params));

            const res = await utils.readFile(params);
            expect(res).toBe(params);

            spyFs.mockRestore();
        });

        it('should throw', async () => {
            const error = 'ERROR';
            const spyFs = jest.spyOn(fs, 'readFile').mockImplementation((data, cb) => cb(error));

            await utils.readFile().catch(e => expect(e).toBe(error));

            spyFs.mockRestore();
        });

        it('should apply custom encoding', async () => {
            const body = { toString: jest.fn() };
            const spyFs = jest.spyOn(fs, 'readFile').mockImplementation((data, cb) => cb(null, body));

            await utils.readFile('a', 'b');
            expect(body.toString).toBeCalledWith('b');

            spyFs.mockRestore();
        });
    });

    describe('listDir', () => {
        it('should list a dir', async () => {
            const params = 'a';
            const spyFs = jest.spyOn(fs, 'readdir').mockImplementation((data, options, cb) => cb(null, params));

            const res = await utils.listDir(params);
            expect(res).toBe(params);

            spyFs.mockRestore();
        });

        it('should throw', async () => {
            const error = 'e';
            const spyFs = jest.spyOn(fs, 'readdir').mockImplementation((data, options, cb) => cb(error));

            await utils.listDir('a').catch(e => expect(e).toBe(error));

            spyFs.mockRestore();
        });

        it('should pass options to fs.readdir', async () => {
            const options = 'a';
            const spyFs = jest.spyOn(fs, 'readdir').mockImplementation((data, opts, cb) => cb(null, opts));

            await utils.listDir('a', options).then(r => expect(r).toBe(options));

            spyFs.mockRestore();
        });
    });
});
