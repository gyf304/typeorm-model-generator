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
const TypeormDriver = require("typeorm/driver/oracle/OracleDriver");
const ColumnInfo_1 = require("../models/ColumnInfo");
const TomgUtils = require("../Utils");
const AbstractDriver_1 = require("./AbstractDriver");
class OracleDriver extends AbstractDriver_1.AbstractDriver {
    constructor() {
        super();
        this.defaultValues = new TypeormDriver.OracleDriver({
            options: undefined
        }).dataTypeDefaults;
        this.standardPort = 1521;
        this.standardUser = "SYS";
        this.standardSchema = "";
        this.GetAllTablesQuery = (schema) => __awaiter(this, void 0, void 0, function* () {
            const response = (yield this.Connection.execute(` SELECT NULL AS TABLE_SCHEMA, TABLE_NAME, NULL AS DB_NAME FROM all_tables WHERE  owner = (select user from dual)`)).rows;
            return response;
        });
        try {
            this.Oracle = require("oracledb");
            this.Oracle.outFormat = this.Oracle.OBJECT;
        }
        catch (error) {
            TomgUtils.LogError("", false, error);
            throw error;
        }
    }
    GetEnums(schema) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error("This fork of typeorm-models only supports postgres right now");
        });
    }
    GetCoulmnsFromEntity(entities, schema) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = (yield this.Connection
                .execute(`SELECT utc.TABLE_NAME, utc.COLUMN_NAME, DATA_DEFAULT, NULLABLE, DATA_TYPE, DATA_LENGTH,
            DATA_PRECISION, DATA_SCALE, IDENTITY_COLUMN,
            (select count(*) from USER_CONS_COLUMNS ucc
             JOIN USER_CONSTRAINTS uc ON  uc.CONSTRAINT_NAME = ucc.CONSTRAINT_NAME and uc.CONSTRAINT_TYPE='U'
            where ucc.column_name = utc.COLUMN_NAME AND ucc.table_name = utc.TABLE_NAME) IS_UNIQUE
           FROM USER_TAB_COLUMNS utc`)).rows;
            entities.forEach(ent => {
                response
                    .filter(filterVal => filterVal.TABLE_NAME === ent.tsEntityName)
                    .forEach(resp => {
                    const colInfo = new ColumnInfo_1.ColumnInfo();
                    colInfo.tsName = resp.COLUMN_NAME;
                    colInfo.options.name = resp.COLUMN_NAME;
                    colInfo.options.nullable = resp.NULLABLE === "Y";
                    colInfo.options.generated = resp.IDENTITY_COLUMN === "YES";
                    colInfo.options.default =
                        !resp.DATA_DEFAULT || resp.DATA_DEFAULT.includes('"')
                            ? null
                            : this.ReturnDefaultValueFunction(resp.DATA_DEFAULT);
                    colInfo.options.unique = resp.IS_UNIQUE > 0;
                    resp.DATA_TYPE = resp.DATA_TYPE.replace(/\([0-9]+\)/g, "");
                    colInfo.options.type = resp.DATA_TYPE.toLowerCase();
                    switch (resp.DATA_TYPE.toLowerCase()) {
                        case "char":
                            colInfo.tsType = "string";
                            break;
                        case "nchar":
                            colInfo.tsType = "string";
                            break;
                        case "nvarchar2":
                            colInfo.tsType = "string";
                            break;
                        case "varchar2":
                            colInfo.tsType = "string";
                            break;
                        case "long":
                            colInfo.tsType = "string";
                            break;
                        case "raw":
                            colInfo.tsType = "Buffer";
                            break;
                        case "long raw":
                            colInfo.tsType = "Buffer";
                            break;
                        case "number":
                            colInfo.tsType = "number";
                            break;
                        case "numeric":
                            colInfo.tsType = "number";
                            break;
                        case "float":
                            colInfo.tsType = "number";
                            break;
                        case "dec":
                            colInfo.tsType = "number";
                            break;
                        case "decimal":
                            colInfo.tsType = "number";
                            break;
                        case "integer":
                            colInfo.tsType = "number";
                            break;
                        case "int":
                            colInfo.tsType = "number";
                            break;
                        case "smallint":
                            colInfo.tsType = "number";
                            break;
                        case "real":
                            colInfo.tsType = "number";
                            break;
                        case "double precision":
                            colInfo.tsType = "number";
                            break;
                        case "date":
                            colInfo.tsType = "Date";
                            break;
                        case "timestamp":
                            colInfo.tsType = "Date";
                            break;
                        case "timestamp with time zone":
                            colInfo.tsType = "Date";
                            break;
                        case "timestamp with local time zone":
                            colInfo.tsType = "Date";
                            break;
                        case "interval year to month":
                            colInfo.tsType = "string";
                            break;
                        case "interval day to second":
                            colInfo.tsType = "string";
                            break;
                        case "bfile":
                            colInfo.tsType = "Buffer";
                            break;
                        case "blob":
                            colInfo.tsType = "Buffer";
                            break;
                        case "clob":
                            colInfo.tsType = "string";
                            break;
                        case "nclob":
                            colInfo.tsType = "string";
                            break;
                        case "rowid":
                            colInfo.tsType = "number";
                            break;
                        case "urowid":
                            colInfo.tsType = "number";
                            break;
                        default:
                            TomgUtils.LogError("Unknown column type:" + resp.DATA_TYPE);
                            break;
                    }
                    if (this.ColumnTypesWithPrecision.some(v => v === colInfo.options.type)) {
                        colInfo.options.precision = resp.DATA_PRECISION;
                        colInfo.options.scale = resp.DATA_SCALE;
                    }
                    if (this.ColumnTypesWithLength.some(v => v === colInfo.options.type)) {
                        colInfo.options.length =
                            resp.DATA_LENGTH > 0 ? resp.DATA_LENGTH : undefined;
                    }
                    if (colInfo.options.type) {
                        ent.Columns.push(colInfo);
                    }
                });
            });
            return entities;
        });
    }
    GetIndexesFromEntity(entities, schema) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = (yield this.Connection
                .execute(`SELECT ind.TABLE_NAME, ind.INDEX_NAME, col.COLUMN_NAME,ind.UNIQUENESS, CASE WHEN uc.CONSTRAINT_NAME IS NULL THEN 0 ELSE 1 END ISPRIMARYKEY
        FROM USER_INDEXES ind
        JOIN USER_IND_COLUMNS col ON ind.INDEX_NAME=col.INDEX_NAME
        LEFT JOIN USER_CONSTRAINTS uc ON  uc.INDEX_NAME = ind.INDEX_NAME
        ORDER BY col.INDEX_NAME ASC ,col.COLUMN_POSITION ASC`)).rows;
            entities.forEach(ent => {
                response
                    .filter(filterVal => filterVal.TABLE_NAME === ent.tsEntityName)
                    .forEach(resp => {
                    let indexInfo = {};
                    const indexColumnInfo = {};
                    if (ent.Indexes.filter(filterVal => filterVal.name === resp.INDEX_NAME).length > 0) {
                        indexInfo = ent.Indexes.find(filterVal => filterVal.name === resp.INDEX_NAME);
                    }
                    else {
                        indexInfo.columns = [];
                        indexInfo.name = resp.INDEX_NAME;
                        indexInfo.isUnique = resp.UNIQUENESS === "UNIQUE";
                        indexInfo.isPrimaryKey = resp.ISPRIMARYKEY === 1;
                        ent.Indexes.push(indexInfo);
                    }
                    indexColumnInfo.name = resp.COLUMN_NAME;
                    indexInfo.columns.push(indexColumnInfo);
                });
            });
            return entities;
        });
    }
    GetRelations(entities, schema) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = (yield this.Connection
                .execute(`select owner.TABLE_NAME OWNER_TABLE_NAME,ownCol.POSITION OWNER_POSITION,ownCol.COLUMN_NAME OWNER_COLUMN_NAME,
        child.TABLE_NAME CHILD_TABLE_NAME ,childCol.COLUMN_NAME CHILD_COLUMN_NAME,
        owner.DELETE_RULE,
        owner.CONSTRAINT_NAME
        from user_constraints owner
        join user_constraints child on owner.r_constraint_name=child.CONSTRAINT_NAME and child.constraint_type in ('P','U')
        JOIN USER_CONS_COLUMNS ownCol ON owner.CONSTRAINT_NAME = ownCol.CONSTRAINT_NAME
        JOIN USER_CONS_COLUMNS childCol ON child.CONSTRAINT_NAME = childCol.CONSTRAINT_NAME AND ownCol.POSITION=childCol.POSITION
        ORDER BY OWNER_TABLE_NAME ASC, owner.CONSTRAINT_NAME ASC, OWNER_POSITION ASC`))
                .rows;
            const relationsTemp = [];
            response.forEach(resp => {
                let rels = relationsTemp.find(val => val.object_id === resp.CONSTRAINT_NAME);
                if (rels === undefined) {
                    rels = {};
                    rels.ownerColumnsNames = [];
                    rels.referencedColumnsNames = [];
                    rels.actionOnDelete =
                        resp.DELETE_RULE === "NO ACTION" ? null : resp.DELETE_RULE;
                    rels.actionOnUpdate = null;
                    rels.object_id = resp.CONSTRAINT_NAME;
                    rels.ownerTable = resp.OWNER_TABLE_NAME;
                    rels.referencedTable = resp.CHILD_TABLE_NAME;
                    relationsTemp.push(rels);
                }
                rels.ownerColumnsNames.push(resp.OWNER_COLUMN_NAME);
                rels.referencedColumnsNames.push(resp.CHILD_COLUMN_NAME);
            });
            entities = this.GetRelationsFromRelationTempInfo(relationsTemp, entities);
            return entities;
        });
    }
    DisconnectFromServer() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.Connection) {
                yield this.Connection.close();
            }
        });
    }
    ConnectToServer(connectionOptons) {
        return __awaiter(this, void 0, void 0, function* () {
            let config;
            if (connectionOptons.user === String(process.env.ORACLE_UsernameSys)) {
                config /*Oracle.IConnectionAttributes*/ = {
                    connectString: `${connectionOptons.host}:${connectionOptons.port}/${connectionOptons.databaseName}`,
                    externalAuth: connectionOptons.ssl,
                    password: connectionOptons.password,
                    privilege: this.Oracle.SYSDBA,
                    user: connectionOptons.user
                };
            }
            else {
                config /*Oracle.IConnectionAttributes*/ = {
                    connectString: `${connectionOptons.host}:${connectionOptons.port}/${connectionOptons.databaseName}`,
                    externalAuth: connectionOptons.ssl,
                    password: connectionOptons.password,
                    user: connectionOptons.user
                };
            }
            const that = this;
            const promise = new Promise((resolve, reject) => {
                this.Oracle.getConnection(config, (err, connection) => {
                    if (!err) {
                        that.Connection = connection;
                        resolve(true);
                    }
                    else {
                        TomgUtils.LogError("Error connecting to Oracle Server.", false, err.message);
                        reject(err);
                    }
                });
            });
            yield promise;
        });
    }
    CreateDB(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.Connection.execute(`CREATE USER ${dbName} IDENTIFIED BY ${String(process.env.ORACLE_Password)}`);
            yield this.Connection.execute(`GRANT CONNECT TO ${dbName}`);
        });
    }
    UseDB(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            // not supported
        });
    }
    DropDB(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.Connection.execute(`DROP USER ${dbName} CASCADE`);
        });
    }
    CheckIfDBExists(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            const x = yield this.Connection.execute(`select count(*) as CNT from dba_users where username='${dbName.toUpperCase()}'`);
            return x.rows[0][0] > 0 || x.rows[0].CNT;
        });
    }
    ReturnDefaultValueFunction(defVal) {
        if (!defVal) {
            return null;
        }
        if (defVal.endsWith(" ")) {
            defVal = defVal.slice(0, -1);
        }
        if (defVal.startsWith(`'`)) {
            return `() => "${defVal}"`;
        }
        return `() => "${defVal}"`;
    }
}
exports.OracleDriver = OracleDriver;
//# sourceMappingURL=OracleDriver.js.map