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
const MYSQL = require("mysql");
const TypeormDriver = require("typeorm/driver/mysql/MysqlDriver");
const ColumnInfo_1 = require("../models/ColumnInfo");
const TomgUtils = require("../Utils");
const AbstractDriver_1 = require("./AbstractDriver");
class MysqlDriver extends AbstractDriver_1.AbstractDriver {
    constructor() {
        super(...arguments);
        this.defaultValues = new TypeormDriver.MysqlDriver({
            options: { replication: undefined }
        }).dataTypeDefaults;
        this.EngineName = "MySQL";
        this.standardPort = 3306;
        this.standardUser = "root";
        this.standardSchema = "";
        this.GetAllTablesQuery = (schema, dbNames) => __awaiter(this, void 0, void 0, function* () {
            const response = this.ExecQuery(`SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_SCHEMA as DB_NAME
            FROM information_schema.tables
            WHERE table_type='BASE TABLE'
            AND table_schema IN (${this.escapeCommaSeparatedList(dbNames)})`);
            return response;
        });
    }
    GetEnums(schema) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error("This fork of typeorm-models only supports postgres right now");
        });
    }
    GetCoulmnsFromEntity(entities, schema, dbNames) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.ExecQuery(`SELECT TABLE_NAME,COLUMN_NAME,COLUMN_DEFAULT,IS_NULLABLE,
            DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,NUMERIC_PRECISION,NUMERIC_SCALE,
            CASE WHEN EXTRA like '%auto_increment%' THEN 1 ELSE 0 END IsIdentity, COLUMN_TYPE, COLUMN_KEY
            FROM INFORMATION_SCHEMA.COLUMNS where TABLE_SCHEMA IN (${this.escapeCommaSeparatedList(dbNames)})
			order by ordinal_position`);
            entities.forEach(ent => {
                response
                    .filter(filterVal => filterVal.TABLE_NAME === ent.tsEntityName)
                    .forEach(resp => {
                    const colInfo = new ColumnInfo_1.ColumnInfo();
                    colInfo.tsName = resp.COLUMN_NAME;
                    colInfo.options.name = resp.COLUMN_NAME;
                    colInfo.options.nullable = resp.IS_NULLABLE === "YES";
                    colInfo.options.generated = resp.IsIdentity === 1;
                    colInfo.options.unique = resp.COLUMN_KEY === "UNI";
                    colInfo.options.default = this.ReturnDefaultValueFunction(resp.COLUMN_DEFAULT);
                    colInfo.options.type = resp.DATA_TYPE;
                    switch (resp.DATA_TYPE) {
                        case "int":
                            colInfo.tsType = "number";
                            break;
                        case "bit":
                            if (resp.COLUMN_TYPE === "bit(1)") {
                                colInfo.options.width = 1;
                                colInfo.tsType = "boolean";
                            }
                            else {
                                colInfo.tsType = "number";
                            }
                            break;
                        case "tinyint":
                            if (resp.COLUMN_TYPE === "tinyint(1)") {
                                colInfo.options.width = 1;
                                colInfo.tsType = "boolean";
                            }
                            else {
                                colInfo.tsType = "number";
                            }
                            break;
                        case "smallint":
                            colInfo.tsType = "number";
                            break;
                        case "mediumint":
                            colInfo.tsType = "number";
                            break;
                        case "bigint":
                            colInfo.tsType = "string";
                            break;
                        case "float":
                            colInfo.tsType = "number";
                            break;
                        case "double":
                            colInfo.tsType = "number";
                            break;
                        case "decimal":
                            colInfo.tsType = "string";
                            break;
                        case "date":
                            colInfo.tsType = "string";
                            break;
                        case "datetime":
                            colInfo.tsType = "Date";
                            break;
                        case "timestamp":
                            colInfo.tsType = "Date";
                            break;
                        case "time":
                            colInfo.tsType = "string";
                            break;
                        case "year":
                            colInfo.tsType = "number";
                            break;
                        case "char":
                            colInfo.tsType = "string";
                            break;
                        case "varchar":
                            colInfo.tsType = "string";
                            break;
                        case "blob":
                            colInfo.tsType = "Buffer";
                            break;
                        case "text":
                            colInfo.tsType = "string";
                            break;
                        case "tinyblob":
                            colInfo.tsType = "Buffer";
                            break;
                        case "tinytext":
                            colInfo.tsType = "string";
                            break;
                        case "mediumblob":
                            colInfo.tsType = "Buffer";
                            break;
                        case "mediumtext":
                            colInfo.tsType = "string";
                            break;
                        case "longblob":
                            colInfo.tsType = "Buffer";
                            break;
                        case "longtext":
                            colInfo.tsType = "string";
                            break;
                        case "enum":
                            colInfo.tsType = "string";
                            colInfo.options.enum = resp.COLUMN_TYPE.substring(5, resp.COLUMN_TYPE.length - 1).replace(/\'/gi, '"');
                            break;
                        case "json":
                            colInfo.tsType = "Object";
                            break;
                        case "binary":
                            colInfo.tsType = "Buffer";
                            break;
                        case "varbinary":
                            colInfo.tsType = "Buffer";
                            break;
                        case "geometry":
                            colInfo.tsType = "string";
                            break;
                        case "point":
                            colInfo.tsType = "string";
                            break;
                        case "linestring":
                            colInfo.tsType = "string";
                            break;
                        case "polygon":
                            colInfo.tsType = "string";
                            break;
                        case "multipoint":
                            colInfo.tsType = "string";
                            break;
                        case "multilinestring":
                            colInfo.tsType = "string";
                            break;
                        case "multipolygon":
                            colInfo.tsType = "string";
                            break;
                        case "geometrycollection":
                        case "geomcollection":
                            colInfo.options.type = "geometrycollection";
                            colInfo.tsType = "string";
                            break;
                        default:
                            TomgUtils.LogError(`Unknown column type: ${resp.DATA_TYPE}  table name: ${resp.TABLE_NAME} column name: ${resp.COLUMN_NAME}`);
                            break;
                    }
                    if (this.ColumnTypesWithPrecision.some(v => v === colInfo.options.type)) {
                        colInfo.options.precision = resp.NUMERIC_PRECISION;
                        colInfo.options.scale = resp.NUMERIC_SCALE;
                    }
                    if (this.ColumnTypesWithLength.some(v => v === colInfo.options.type)) {
                        colInfo.options.length =
                            resp.CHARACTER_MAXIMUM_LENGTH > 0
                                ? resp.CHARACTER_MAXIMUM_LENGTH
                                : undefined;
                    }
                    if (this.ColumnTypesWithWidth.some(v => v === colInfo.options.type &&
                        colInfo.tsType !== "boolean")) {
                        colInfo.options.width =
                            resp.CHARACTER_MAXIMUM_LENGTH > 0
                                ? resp.CHARACTER_MAXIMUM_LENGTH
                                : undefined;
                    }
                    if (colInfo.options.type) {
                        ent.Columns.push(colInfo);
                    }
                });
            });
            return entities;
        });
    }
    GetIndexesFromEntity(entities, schema, dbNames) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.ExecQuery(`SELECT TABLE_NAME TableName,INDEX_NAME IndexName,COLUMN_NAME ColumnName,CASE WHEN NON_UNIQUE=0 THEN 1 ELSE 0 END is_unique,
            CASE WHEN INDEX_NAME='PRIMARY' THEN 1 ELSE 0 END is_primary_key
            FROM information_schema.statistics sta
            WHERE table_schema IN (${this.escapeCommaSeparatedList(dbNames)})`);
            entities.forEach(ent => {
                response
                    .filter(filterVal => filterVal.TableName === ent.tsEntityName)
                    .forEach(resp => {
                    let indexInfo = {};
                    const indexColumnInfo = {};
                    if (ent.Indexes.filter(filterVal => filterVal.name === resp.IndexName).length > 0) {
                        indexInfo = ent.Indexes.find(filterVal => filterVal.name === resp.IndexName);
                    }
                    else {
                        indexInfo.columns = [];
                        indexInfo.name = resp.IndexName;
                        indexInfo.isUnique = resp.is_unique === 1;
                        indexInfo.isPrimaryKey = resp.is_primary_key === 1;
                        ent.Indexes.push(indexInfo);
                    }
                    indexColumnInfo.name = resp.ColumnName;
                    indexInfo.columns.push(indexColumnInfo);
                });
            });
            return entities;
        });
    }
    GetRelations(entities, schema, dbNames) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.ExecQuery(`SELECT
            CU.TABLE_NAME TableWithForeignKey,
            CU.ORDINAL_POSITION FK_PartNo,
            CU.COLUMN_NAME ForeignKeyColumn,
            CU.REFERENCED_TABLE_NAME TableReferenced,
            CU.REFERENCED_COLUMN_NAME ForeignKeyColumnReferenced,
            RC.DELETE_RULE onDelete,
            RC.UPDATE_RULE onUpdate,
            CU.CONSTRAINT_NAME object_id
           FROM
            INFORMATION_SCHEMA.KEY_COLUMN_USAGE CU
           JOIN
            INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS RC
                ON CU.CONSTRAINT_NAME=RC.CONSTRAINT_NAME AND CU.CONSTRAINT_SCHEMA = RC.CONSTRAINT_SCHEMA
          WHERE
            TABLE_SCHEMA IN (${this.escapeCommaSeparatedList(dbNames)})
            AND CU.REFERENCED_TABLE_NAME IS NOT NULL;
            `);
            const relationsTemp = [];
            response.forEach(resp => {
                let rels = relationsTemp.find(val => val.object_id === resp.object_id);
                if (rels === undefined) {
                    rels = {};
                    rels.ownerColumnsNames = [];
                    rels.referencedColumnsNames = [];
                    rels.actionOnDelete =
                        resp.onDelete === "NO_ACTION" ? null : resp.onDelete;
                    rels.actionOnUpdate =
                        resp.onUpdate === "NO_ACTION" ? null : resp.onUpdate;
                    rels.object_id = resp.object_id;
                    rels.ownerTable = resp.TableWithForeignKey;
                    rels.referencedTable = resp.TableReferenced;
                    relationsTemp.push(rels);
                }
                rels.ownerColumnsNames.push(resp.ForeignKeyColumn);
                rels.referencedColumnsNames.push(resp.ForeignKeyColumnReferenced);
            });
            entities = this.GetRelationsFromRelationTempInfo(relationsTemp, entities);
            return entities;
        });
    }
    DisconnectFromServer() {
        return __awaiter(this, void 0, void 0, function* () {
            const promise = new Promise((resolve, reject) => {
                this.Connection.end(err => {
                    if (!err) {
                        resolve(true);
                    }
                    else {
                        TomgUtils.LogError(`Error disconnecting to ${this.EngineName} Server.`, false, err.message);
                        reject(err);
                    }
                });
            });
            if (this.Connection) {
                yield promise;
            }
        });
    }
    ConnectToServer(connectionOptons) {
        return __awaiter(this, void 0, void 0, function* () {
            const databaseName = connectionOptons.databaseName.split(",")[0];
            let config;
            if (connectionOptons.ssl) {
                config = {
                    database: databaseName,
                    host: connectionOptons.host,
                    password: connectionOptons.password,
                    port: connectionOptons.port,
                    ssl: {
                        rejectUnauthorized: false
                    },
                    user: connectionOptons.user
                };
            }
            else {
                config = {
                    database: databaseName,
                    host: connectionOptons.host,
                    password: connectionOptons.password,
                    port: connectionOptons.port,
                    user: connectionOptons.user
                };
            }
            const promise = new Promise((resolve, reject) => {
                this.Connection = MYSQL.createConnection(config);
                this.Connection.connect(err => {
                    if (!err) {
                        resolve(true);
                    }
                    else {
                        TomgUtils.LogError(`Error connecting to ${this.EngineName} Server.`, false, err.message);
                        reject(err);
                    }
                });
            });
            yield promise;
        });
    }
    CreateDB(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ExecQuery(`CREATE DATABASE ${dbName}; `);
        });
    }
    UseDB(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ExecQuery(`USE ${dbName}; `);
        });
    }
    DropDB(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ExecQuery(`DROP DATABASE ${dbName}; `);
        });
    }
    CheckIfDBExists(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = yield this.ExecQuery(`SHOW DATABASES LIKE '${dbName}' `);
            return resp.length > 0;
        });
    }
    ExecQuery(sql) {
        return __awaiter(this, void 0, void 0, function* () {
            const ret = [];
            const query = this.Connection.query(sql);
            const stream = query.stream({});
            const promise = new Promise((resolve, reject) => {
                stream.on("data", chunk => {
                    ret.push(chunk);
                });
                stream.on("error", err => reject(err));
                stream.on("end", () => resolve(true));
            });
            yield promise;
            return ret;
        });
    }
    ReturnDefaultValueFunction(defVal) {
        if (!defVal || defVal === "NULL") {
            return null;
        }
        if (defVal.toLowerCase() === "current_timestamp()") {
            defVal = "CURRENT_TIMESTAMP";
        }
        if (defVal === "CURRENT_TIMESTAMP" || defVal.startsWith(`'`)) {
            return `() => "${defVal}"`;
        }
        return `() => "'${defVal}'"`;
    }
}
exports.MysqlDriver = MysqlDriver;
//# sourceMappingURL=MysqlDriver.js.map