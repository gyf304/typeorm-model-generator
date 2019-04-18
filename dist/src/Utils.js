"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const packagejson = require("./../../package.json");
function LogError(errText, isABug = true, errObject) {
    console.error(errText);
    console.error(`Error occured in typeorm-model-generator.`);
    console.error(`${packageVersion()}  node@${process.version}`);
    console.error(`If you think this is a bug please open an issue including this log on ${packagejson.bugs.url}`);
    if (isABug && !errObject) {
        errObject = new Error().stack;
    }
    if (!!errObject) {
        console.error(errObject);
    }
}
exports.LogError = LogError;
function packageVersion() {
    return `${packagejson.name}@${packagejson.version}`;
}
exports.packageVersion = packageVersion;
//# sourceMappingURL=Utils.js.map