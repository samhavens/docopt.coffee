#!/usr/bin/env node
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const {docopt} = require('../docopt');

let doc = '';

process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => doc += chunk);

process.stdin.on('end', () => {
    try {
        return console.log(JSON.stringify(docopt(doc)));
    } catch (e) {
        return console.log('"user-error"');
    }
});
