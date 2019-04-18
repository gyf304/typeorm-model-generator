"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RelationInfo {
    constructor() {
        this.relationIdField = false;
    }
    get isOneToMany() {
        return this.relationType === "OneToMany";
    }
    get isManyToMany() {
        return this.relationType === "ManyToMany";
    }
    get isOneToOne() {
        return this.relationType === "OneToOne";
    }
    get isManyToOne() {
        return this.relationType === "ManyToOne";
    }
}
exports.RelationInfo = RelationInfo;
//# sourceMappingURL=RelationInfo.js.map