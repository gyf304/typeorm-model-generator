"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class EntityInfo {
    relationImports() {
        const imports = [];
        this.Columns.forEach(column => {
            if (column.isCustomType) {
                imports.push(column.tsType);
            }
            column.relations.forEach(relation => {
                if (this.tsEntityName !== relation.relatedTable) {
                    imports.push(relation.relatedTable);
                }
            });
        });
        this.UniqueImports = imports.filter((elem, index, self) => index === self.indexOf(elem));
    }
}
exports.EntityInfo = EntityInfo;
//# sourceMappingURL=EntityInfo.js.map