"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ColumnInfo_1 = require("../models/ColumnInfo");
const EntityInfo_1 = require("../models/EntityInfo");
const RelationInfo_1 = require("../models/RelationInfo");
const TomgUtils = require("../Utils");
const util = require("util");
class AbstractDriver {
    constructor() {
        this.ColumnTypesWithWidth = [
            "tinyint",
            "smallint",
            "mediumint",
            "int",
            "bigint"
        ];
        this.ColumnTypesWithPrecision = [
            "float",
            "double",
            "dec",
            "decimal",
            "numeric",
            "real",
            "double precision",
            "number",
            "datetime",
            "datetime2",
            "datetimeoffset",
            "time",
            "time with time zone",
            "time without time zone",
            "timestamp",
            "timestamp without time zone",
            "timestamp with time zone",
            "timestamp with local time zone"
        ];
        this.ColumnTypesWithLength = [
            "character varying",
            "varying character",
            "nvarchar",
            "character",
            "native character",
            "varchar",
            "char",
            "nchar",
            "varchar2",
            "nvarchar2",
            "raw",
            "binary",
            "varbinary"
        ];
        this.customTypes = [];
    }
    FindManyToManyRelations(dbModel) {
        const manyToManyEntities = dbModel.filter(entity => entity.Columns.filter(column => {
            return (column.relations.length === 1 &&
                !column.relations[0].isOneToMany &&
                column.relations[0].isOwner);
        }).length === entity.Columns.length);
        manyToManyEntities.map(entity => {
            let relations = [];
            relations = entity.Columns.reduce((prev, curr) => prev.concat(curr.relations), relations);
            const namesOfRelatedTables = relations
                .map(v => v.relatedTable)
                .filter((v, i, s) => s.indexOf(v) === i);
            if (namesOfRelatedTables.length === 2) {
                const relatedTable1 = dbModel.find(v => v.tsEntityName === namesOfRelatedTables[0]);
                relatedTable1.Columns = relatedTable1.Columns.filter(v => !v.tsName
                    .toLowerCase()
                    .startsWith(entity.tsEntityName.toLowerCase()));
                const relatedTable2 = dbModel.find(v => v.tsEntityName === namesOfRelatedTables[1]);
                relatedTable2.Columns = relatedTable2.Columns.filter(v => !v.tsName
                    .toLowerCase()
                    .startsWith(entity.tsEntityName.toLowerCase()));
                dbModel = dbModel.filter(ent => {
                    return ent.tsEntityName !== entity.tsEntityName;
                });
                const column1 = new ColumnInfo_1.ColumnInfo();
                column1.tsName = namesOfRelatedTables[1];
                column1.options.name = entity.sqlEntityName;
                const col1Rel = new RelationInfo_1.RelationInfo();
                col1Rel.relatedTable = namesOfRelatedTables[1];
                col1Rel.relatedColumn = namesOfRelatedTables[1];
                col1Rel.relationType = "ManyToMany";
                col1Rel.isOwner = true;
                col1Rel.ownerColumn = namesOfRelatedTables[0];
                const entityColumnsWithRelations = entity.Columns.filter(col => col.relations.length > 0);
                const x = util.inspect.defaultOptions.depth;
                util.inspect.defaultOptions.depth = 1000;
                console.log(entity.Columns, namesOfRelatedTables);
                util.inspect.defaultOptions.depth = x;
                col1Rel.joinInfo = {
                    inverseJoinColumns: entity.Columns.filter(col => col.relations.some(rel => rel.relatedTable === namesOfRelatedTables[1])).map(col => col.options.name),
                    joinColumns: entity.Columns.filter(col => col.relations.some(rel => rel.relatedTable === namesOfRelatedTables[0])).map(col => col.options.name),
                    joinTable: entity.sqlEntityName
                };
                console.log(col1Rel.joinInfo);
                column1.relations.push(col1Rel);
                relatedTable1.Columns.push(column1);
                const column2 = new ColumnInfo_1.ColumnInfo();
                column2.tsName = namesOfRelatedTables[0];
                const col2Rel = new RelationInfo_1.RelationInfo();
                col2Rel.relatedTable = namesOfRelatedTables[0];
                col2Rel.relatedColumn = namesOfRelatedTables[1];
                col2Rel.relationType = "ManyToMany";
                col2Rel.isOwner = false;
                column2.relations.push(col2Rel);
                relatedTable2.Columns.push(column2);
            }
        });
        return dbModel;
    }
    GetDataFromServer(connectionOptons) {
        return __awaiter(this, void 0, void 0, function* () {
            let dbModel = [];
            yield this.ConnectToServer(connectionOptons);
            const sqlEscapedSchema = this.escapeCommaSeparatedList(connectionOptons.schemaName);
            this.customTypes = yield this.GetEnums(sqlEscapedSchema);
            dbModel = yield this.GetAllTables(sqlEscapedSchema, connectionOptons.databaseName);
            yield this.GetCoulmnsFromEntity(dbModel, sqlEscapedSchema, connectionOptons.databaseName);
            yield this.GetIndexesFromEntity(dbModel, sqlEscapedSchema, connectionOptons.databaseName);
            dbModel = yield this.GetRelations(dbModel, sqlEscapedSchema, connectionOptons.databaseName);
            yield this.DisconnectFromServer();
            dbModel = this.FindManyToManyRelations(dbModel);
            this.FindPrimaryColumnsFromIndexes(dbModel);
            return [dbModel, this.customTypes];
        });
    }
    GetAllTables(schema, dbNames) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.GetAllTablesQuery(schema, dbNames);
            const ret = [];
            response.forEach(val => {
                const ent = new EntityInfo_1.EntityInfo();
                ent.tsEntityName = val.TABLE_NAME;
                ent.sqlEntityName = val.TABLE_NAME;
                ent.Schema = val.TABLE_SCHEMA;
                ent.Columns = [];
                ent.Indexes = [];
                ent.Database = dbNames.includes(",") ? val.DB_NAME : "";
                ent.Type = val.TABLE_TYPE;
                ret.push(ent);
            });
            return ret;
        });
    }
    GetRelationsFromRelationTempInfo(relationsTemp, entities) {
        relationsTemp.forEach(relationTmp => {
            const ownerEntity = entities.find(entitity => entitity.tsEntityName === relationTmp.ownerTable);
            if (!ownerEntity) {
                TomgUtils.LogError(`Relation between tables ${relationTmp.ownerTable} and ${relationTmp.referencedTable} didn't found entity model ${relationTmp.ownerTable}.`);
                return;
            }
            const referencedEntity = entities.find(entitity => entitity.tsEntityName === relationTmp.referencedTable);
            if (!referencedEntity) {
                TomgUtils.LogError(`Relation between tables ${relationTmp.ownerTable} and ${relationTmp.referencedTable} didn't found entity model ${relationTmp.referencedTable}.`);
                return;
            }
            for (let relationColumnIndex = 0; relationColumnIndex < relationTmp.ownerColumnsNames.length; relationColumnIndex++) {
                const ownerColumn = ownerEntity.Columns.find(column => column.tsName ===
                    relationTmp.ownerColumnsNames[relationColumnIndex]);
                if (!ownerColumn) {
                    TomgUtils.LogError(`Relation between tables ${relationTmp.ownerTable} and ${relationTmp.referencedTable} didn't found entity column ${relationTmp.ownerTable}.${ownerColumn}.`);
                    return;
                }
                const relatedColumn = referencedEntity.Columns.find(column => column.tsName ===
                    relationTmp.referencedColumnsNames[relationColumnIndex]);
                if (!relatedColumn) {
                    TomgUtils.LogError(`Relation between tables ${relationTmp.ownerTable} and ${relationTmp.referencedTable} didn't found entity column ${relationTmp.referencedTable}.${relatedColumn}.`);
                    return;
                }
                let isOneToMany;
                isOneToMany = false;
                const index = ownerEntity.Indexes.find(ind => ind.isUnique &&
                    ind.columns.length === 1 &&
                    ind.columns.some(col => col.name === ownerColumn.tsName));
                isOneToMany = !index;
                const x = util.inspect.defaultOptions.depth;
                util.inspect.defaultOptions.depth = 1000;
                console.log(ownerEntity, ownerColumn);
                util.inspect.defaultOptions.depth = x;
                const ownerRelation = new RelationInfo_1.RelationInfo();
                ownerRelation.actionOnDelete = relationTmp.actionOnDelete;
                ownerRelation.actionOnUpdate = relationTmp.actionOnUpdate;
                ownerRelation.isOwner = true;
                ownerRelation.relatedColumn = relatedColumn.tsName.toLowerCase();
                ownerRelation.relatedTable = relationTmp.referencedTable;
                ownerRelation.ownerTable = relationTmp.ownerTable;
                ownerRelation.relationType = isOneToMany
                    ? "ManyToOne"
                    : "OneToOne";
                let columnName = ownerEntity.tsEntityName;
                if (referencedEntity.Columns.some(v => v.tsName === columnName)) {
                    columnName = columnName + "_";
                    for (let i = 2; i <= referencedEntity.Columns.length; i++) {
                        columnName =
                            columnName.substring(0, columnName.length - i.toString().length) + i.toString();
                        if (referencedEntity.Columns.every(v => v.tsName !== columnName)) {
                            break;
                        }
                    }
                }
                ownerRelation.ownerColumn = columnName;
                ownerColumn.relations.push(ownerRelation);
                if (isOneToMany) {
                    const col = new ColumnInfo_1.ColumnInfo();
                    col.tsName = columnName;
                    const referencedRelation = new RelationInfo_1.RelationInfo();
                    col.relations.push(referencedRelation);
                    referencedRelation.actionOnDelete =
                        relationTmp.actionOnDelete;
                    referencedRelation.actionOnUpdate =
                        relationTmp.actionOnUpdate;
                    referencedRelation.isOwner = false;
                    referencedRelation.relatedColumn = ownerColumn.tsName;
                    referencedRelation.relatedTable = relationTmp.ownerTable;
                    referencedRelation.ownerTable = relationTmp.referencedTable;
                    referencedRelation.ownerColumn = relatedColumn.tsName;
                    referencedRelation.relationType = "OneToMany";
                    referencedEntity.Columns.push(col);
                }
                else {
                    const col = new ColumnInfo_1.ColumnInfo();
                    col.tsName = columnName;
                    const referencedRelation = new RelationInfo_1.RelationInfo();
                    col.relations.push(referencedRelation);
                    referencedRelation.actionOnDelete =
                        relationTmp.actionOnDelete;
                    referencedRelation.actionOnUpdate =
                        relationTmp.actionOnUpdate;
                    referencedRelation.isOwner = false;
                    referencedRelation.relatedColumn = ownerColumn.tsName;
                    referencedRelation.relatedTable = relationTmp.ownerTable;
                    referencedRelation.ownerTable = relationTmp.referencedTable;
                    referencedRelation.ownerColumn = relatedColumn.tsName;
                    referencedRelation.relationType = "OneToOne";
                    referencedEntity.Columns.push(col);
                }
            }
        });
        return entities;
    }
    FindPrimaryColumnsFromIndexes(dbModel) {
        dbModel.forEach(entity => {
            const primaryIndex = entity.Indexes.find(v => v.isPrimaryKey);
            entity.Columns.filter(col => primaryIndex &&
                primaryIndex.columns.some(cIndex => cIndex.name === col.tsName)).forEach(col => (col.options.primary = true));
            if (!entity.Columns.some(v => !!v.options.primary)) {
                if (entity.Type === "VIEW") {
                    // jokes, let's just call everything primary
                    entity.Columns.forEach(col => {
                        col.options.primary = true;
                    });
                }
                else {
                    TomgUtils.LogError(`Table ${entity.tsEntityName} has no PK.`, false);
                    return;
                }
            }
        });
    }
    // TODO: change name
    escapeCommaSeparatedList(commaSeparatedList) {
        return "'" + commaSeparatedList.split(",").join("','") + "'";
    }
}
exports.AbstractDriver = AbstractDriver;
//# sourceMappingURL=AbstractDriver.js.map