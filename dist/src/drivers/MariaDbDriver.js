"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MysqlDriver_1 = require("./MysqlDriver");
class MariaDbDriver extends MysqlDriver_1.MysqlDriver {
    constructor() {
        super(...arguments);
        this.EngineName = "MariaDb";
    }
}
exports.MariaDbDriver = MariaDbDriver;
//# sourceMappingURL=MariaDbDriver.js.map