"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AbstractNamingStrategy_1 = require("./AbstractNamingStrategy");
class NamingStrategy extends AbstractNamingStrategy_1.AbstractNamingStrategy {
    relationName(columnOldName, relation, dbModel) {
        const isRelationToMany = relation.isOneToMany || relation.isManyToMany;
        const ownerEntity = dbModel.find(v => v.tsEntityName === relation.ownerTable);
        let columnName = columnOldName[0].toLowerCase() +
            columnOldName.substring(1, columnOldName.length);
        if (columnName.toLowerCase().endsWith("id") &&
            !columnName.toLowerCase().endsWith("guid")) {
            columnName = columnName.substring(0, columnName.toLowerCase().lastIndexOf("id"));
        }
        if (!isNaN(parseInt(columnName[columnName.length - 1], 10))) {
            columnName = columnName.substring(0, columnName.length - 1);
        }
        if (!isNaN(parseInt(columnName[columnName.length - 1], 10))) {
            columnName = columnName.substring(0, columnName.length - 1);
        }
        columnName += isRelationToMany ? "s" : "";
        if (relation.relationType !== "ManyToMany" &&
            columnOldName !== columnName) {
            if (ownerEntity.Columns.some(v => v.tsName === columnName)) {
                columnName = columnName + "_";
                for (let i = 2; i <= ownerEntity.Columns.length; i++) {
                    columnName =
                        columnName.substring(0, columnName.length - i.toString().length) + i.toString();
                    if (ownerEntity.Columns.every(v => v.tsName !== columnName ||
                        columnName === columnOldName)) {
                        break;
                    }
                }
            }
        }
        return columnName;
    }
    entityName(entityName) {
        return entityName;
    }
    columnName(columnName) {
        return columnName;
    }
}
exports.NamingStrategy = NamingStrategy;
//# sourceMappingURL=NamingStrategy.js.map