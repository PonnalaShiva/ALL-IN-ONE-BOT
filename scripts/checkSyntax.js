'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ignoredDirectories = new Set(['.git', 'node_modules']);
const javascriptFiles = [];

function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(fullPath);
        else if (entry.isFile() && fullPath.endsWith('.js')) javascriptFiles.push(fullPath);
    }
}

collect(path.resolve(__dirname, '..'));
const failures = [];
for (const file of javascriptFiles) {
    try {
        new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
    } catch (error) {
        failures.push({ file: path.relative(process.cwd(), file), message: error.message });
    }
}

console.log(`[SYNTAX] Checked ${javascriptFiles.length} JavaScript files; failures: ${failures.length}.`);
for (const failure of failures) console.error(`[SYNTAX] ${failure.file}: ${failure.message}`);
if (failures.length) process.exitCode = 1;
