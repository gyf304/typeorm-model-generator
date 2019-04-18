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
const changeCase = require("change-case");
const PG = require("pg");
const TypeormDriver = require("typeorm/driver/postgres/PostgresDriver");
const ColumnInfo_1 = require("../models/ColumnInfo");
const TomgUtils = require("../Utils");
const AbstractDriver_1 = require("./AbstractDriver");
class PostgresDriver extends AbstractDriver_1.AbstractDriver {
    constructor() {
        super(...arguments);
        this.defaultValues = new TypeormDriver.PostgresDriver({
            options: { replication: undefined }
        }).dataTypeDefaults;
        this.standardPort = 5432;
        this.standardUser = "postgres";
        this.standardSchema = "public";
        this.GetAllTablesQuery = (schema) => __awaiter(this, void 0, void 0, function* () {
            const response = (yield this.Connection.query(`SELECT table_schema as "TABLE_SCHEMA",table_name as "TABLE_NAME", table_catalog as "DB_NAME", table_type as "TABLE_TYPE" FROM INFORMATION_SCHEMA.TABLES WHERE table_schema in (${schema}) `)).rows;
            return response;
        });
    }
    GetEnums(schema) {
        return __awaiter(this, void 0, void 0, function* () {
            const enumsResponse = (yield this.Connection.query(`
            SELECT t.typname AS enum_name,
                e.enumlabel AS enum_value
            FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = ${schema}`)).rows;
            const enums = enumsResponse.reduce((enumMap, { enum_name, enum_value }) => {
                if (!enumMap.has(enum_name)) {
                    enumMap.set(enum_name, []);
                }
                enumMap.get(enum_name).push(enum_value);
                return enumMap;
            }, new Map());
            return Array.from(enums.keys()).map(name => ({
                name,
                values: enums.get(name)
            }));
        });
    }
    GetCoulmnsFromEntity(entities, schema) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = (yield this.Connection
                .query(`SELECT table_name,column_name,udt_name,column_default,is_nullable,
            data_type,character_maximum_length,numeric_precision,numeric_scale,
            case when column_default LIKE 'nextval%' then 'YES' else 'NO' end isidentity,
			(SELECT count(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        inner join INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE cu
            on cu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    where
        tc.CONSTRAINT_TYPE = 'UNIQUE'
        and tc.TABLE_NAME = c.TABLE_NAME
        and cu.COLUMN_NAME = c.COLUMN_NAME
        and tc.TABLE_SCHEMA=c.TABLE_SCHEMA) IsUnique
            FROM INFORMATION_SCHEMA.COLUMNS c
            where table_schema in (${schema})
			order by ordinal_position`)).rows;
            entities.forEach(ent => {
                response
                    .filter(filterVal => filterVal.table_name === ent.tsEntityName)
                    .forEach(resp => {
                    const colInfo = new ColumnInfo_1.ColumnInfo();
                    colInfo.tsName = resp.column_name;
                    colInfo.options.name = resp.column_name;
                    colInfo.options.nullable = resp.is_nullable === "YES";
                    colInfo.options.generated = resp.isidentity === "YES";
                    colInfo.options.unique = resp.isunique === "1";
                    colInfo.options.default = colInfo.options.generated
                        ? null
                        : this.ReturnDefaultValueFunction(resp.column_default);
                    const columnTypes = this.MatchColumnTypes(resp.data_type, resp.udt_name);
                    if (!columnTypes.sql_type || !columnTypes.ts_type) {
                        if (resp.data_type === "USER-DEFINED" ||
                            resp.data_type === "ARRAY") {
                            TomgUtils.LogError(`Unknown ${resp.data_type} column type: ${resp.udt_name}  table name: ${resp.table_name} column name: ${resp.column_name}`);
                        }
                        else {
                            TomgUtils.LogError(`Unknown column type: ${resp.data_type}  table name: ${resp.table_name} column name: ${resp.column_name}`);
                        }
                        return;
                    }
                    colInfo.options.type = columnTypes.sql_type;
                    colInfo.isCustomType = columnTypes.is_custom_type;
                    if (colInfo.isCustomType) {
                        const customEnum = this.customTypes.find(val => val.name === resp.udt_name);
                        if (!customEnum) {
                            TomgUtils.LogError(`Tried to use custom user type ${columnTypes.ts_type}, but was unable to find it in the schema.`);
                            return;
                        }
                        colInfo.options.type = "enum";
                        colInfo.options.enum = customEnum.values;
                    }
                    colInfo.tsType = columnTypes.ts_type;
                    colInfo.options.array = columnTypes.is_array;
                    if (colInfo.options.array) {
                        colInfo.tsType = colInfo.tsType
                            .split("|")
                            .map(x => x.replace("|", "").trim() + "[]")
                            .join(" | ");
                    }
                    if (this.ColumnTypesWithPrecision.some(v => v === colInfo.options.type)) {
                        colInfo.options.precision = resp.numeric_precision;
                        colInfo.options.scale = resp.numeric_scale;
                    }
                    if (this.ColumnTypesWithLength.some(v => v === colInfo.options.type)) {
                        colInfo.options.length =
                            resp.character_maximum_length > 0
                                ? resp.character_maximum_length
                                : undefined;
                    }
                    if (this.ColumnTypesWithWidth.some(v => v === colInfo.options.type)) {
                        colInfo.options.width =
                            resp.character_maximum_length > 0
                                ? resp.character_maximum_length
                                : undefined;
                    }
                    if (colInfo.options.type && colInfo.tsType) {
                        ent.Columns.push(colInfo);
                    }
                });
            });
            return entities;
        });
    }
    MatchColumnTypes(dataType, udtName) {
        const ret = {
            ts_type: null,
            sql_type: null,
            is_array: false,
            is_custom_type: false
        };
        ret.sql_type = dataType;
        switch (dataType) {
            case "int2":
                ret.ts_type = "number";
                break;
            case "int4":
                ret.ts_type = "number";
                break;
            case "int8":
                ret.ts_type = "string";
                break;
            case "smallint":
                ret.ts_type = "number";
                break;
            case "integer":
                ret.ts_type = "number";
                break;
            case "bigint":
                ret.ts_type = "string";
                break;
            case "decimal":
                ret.ts_type = "string";
                break;
            case "numeric":
                ret.ts_type = "string";
                break;
            case "real":
                ret.ts_type = "number";
                break;
            case "float":
                ret.ts_type = "number";
                break;
            case "float4":
                ret.ts_type = "number";
                break;
            case "float8":
                ret.ts_type = "number";
                break;
            case "double precision":
                ret.ts_type = "number";
                break;
            case "money":
                ret.ts_type = "string";
                break;
            case "character varying":
                ret.ts_type = "string";
                break;
            case "varchar":
                ret.ts_type = "string";
                break;
            case "character":
                ret.ts_type = "string";
                break;
            case "char":
                ret.ts_type = "string";
                break;
            case "bpchar":
                ret.sql_type = "char";
                ret.ts_type = "string";
                break;
            case "text":
                ret.ts_type = "string";
                break;
            case "citext":
                ret.ts_type = "string";
                break;
            case "hstore":
                ret.ts_type = "string";
                break;
            case "bytea":
                ret.ts_type = "Buffer";
                break;
            case "bit":
                ret.ts_type = "string";
                break;
            case "varbit":
                ret.ts_type = "string";
                break;
            case "bit varying":
                ret.ts_type = "string";
                break;
            case "timetz":
                ret.ts_type = "string";
                break;
            case "timestamptz":
                ret.ts_type = "Date";
                break;
            case "timestamp":
                ret.ts_type = "string";
                break;
            case "timestamp without time zone":
                ret.ts_type = "Date";
                break;
            case "timestamp with time zone":
                ret.ts_type = "Date";
                break;
            case "date":
                ret.ts_type = "string";
                break;
            case "time":
                ret.ts_type = "string";
                break;
            case "time without time zone":
                ret.ts_type = "string";
                break;
            case "time with time zone":
                ret.ts_type = "string";
                break;
            case "interval":
                ret.ts_type = "any";
                break;
            case "bool":
                ret.ts_type = "boolean";
                break;
            case "boolean":
                ret.ts_type = "boolean";
                break;
            case "enum":
                ret.ts_type = "string";
                break;
            case "point":
                ret.ts_type = "string | Object";
                break;
            case "line":
                ret.ts_type = "string";
                break;
            case "lseg":
                ret.ts_type = "string | string[]";
                break;
            case "box":
                ret.ts_type = "string | Object";
                break;
            case "path":
                ret.ts_type = "string";
                break;
            case "polygon":
                ret.ts_type = "string";
                break;
            case "circle":
                ret.ts_type = "string | Object";
                break;
            case "cidr":
                ret.ts_type = "string";
                break;
            case "inet":
                ret.ts_type = "string";
                break;
            case "macaddr":
                ret.ts_type = "string";
                break;
            case "tsvector":
                ret.ts_type = "string";
                break;
            case "tsquery":
                ret.ts_type = "string";
                break;
            case "uuid":
                ret.ts_type = "string";
                break;
            case "xml":
                ret.ts_type = "string";
                break;
            case "json":
                ret.ts_type = "Object";
                break;
            case "jsonb":
                ret.ts_type = "Object";
                break;
            case "int4range":
                ret.ts_type = "string";
                break;
            case "int8range":
                ret.ts_type = "string";
                break;
            case "numrange":
                ret.ts_type = "string";
                break;
            case "tsrange":
                ret.ts_type = "string";
                break;
            case "tstzrange":
                ret.ts_type = "string";
                break;
            case "daterange":
                ret.ts_type = "string";
                break;
            case "ARRAY":
                const z = this.MatchColumnTypes(udtName.substring(1), udtName);
                ret.ts_type = z.ts_type;
                ret.sql_type = z.sql_type;
                ret.is_array = true;
                break;
            case "USER-DEFINED":
                if (udtName === "citext" ||
                    udtName === "hstore" ||
                    udtName === "geometry") {
                    ret.sql_type = udtName;
                    ret.ts_type = "string";
                    break;
                }
                const type = this.customTypes.find(({ name }) => name === udtName);
                if (type === undefined) {
                    ret.sql_type = null;
                    ret.ts_type = null;
                    break;
                }
                ret.sql_type = udtName;
                ret.ts_type = changeCase.pascalCase(udtName);
                ret.is_custom_type = true;
                break;
            default:
                ret.ts_type = null;
                ret.sql_type = null;
                break;
        }
        return ret;
    }
    GetIndexesFromEntity(entities, schema) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = (yield this.Connection.query(`SELECT
        c.relname AS tablename,
        i.relname as indexname,
        f.attname AS columnname,
        CASE
            WHEN ix.indisunique = true THEN 1
            ELSE 0
        END AS is_unique,
        CASE
            WHEN ix.indisprimary='true' THEN 1
            ELSE 0
        END AS is_primary_key
        FROM pg_attribute f
        JOIN pg_class c ON c.oid = f.attrelid
        JOIN pg_type t ON t.oid = f.atttypid
        LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = f.attnum
        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_index AS ix ON f.attnum = ANY(ix.indkey) and c.oid = f.attrelid and c.oid = ix.indrelid
        LEFT JOIN pg_class AS i ON ix.indexrelid = i.oid
        WHERE c.relkind = 'r'::char
        AND n.nspname in (${schema})
        AND f.attnum > 0
        AND i.oid<>0
        ORDER BY c.relname,f.attname;`)).rows;
            entities.forEach(ent => {
                response
                    .filter(filterVal => filterVal.tablename === ent.tsEntityName)
                    .forEach(resp => {
                    let indexInfo = {};
                    const indexColumnInfo = {};
                    if (ent.Indexes.filter(filterVal => filterVal.name === resp.indexname).length > 0) {
                        indexInfo = ent.Indexes.find(filterVal => filterVal.name === resp.indexname);
                    }
                    else {
                        indexInfo.columns = [];
                        indexInfo.name = resp.indexname;
                        indexInfo.isUnique = resp.is_unique === 1;
                        indexInfo.isPrimaryKey = resp.is_primary_key === 1;
                        ent.Indexes.push(indexInfo);
                    }
                    indexColumnInfo.name = resp.columnname;
                    if (resp.is_primary_key === 0) {
                        indexInfo.isPrimaryKey = false;
                    }
                    indexInfo.columns.push(indexColumnInfo);
                });
            });
            return entities;
        });
    }
    GetRelations(entities, schema) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = (yield this.Connection.query(`SELECT DISTINCT
            con.relname AS tablewithforeignkey,
            att.attnum as fk_partno,
                 att2.attname AS foreignkeycolumn,
              cl.relname AS tablereferenced,
              att.attname AS foreignkeycolumnreferenced,
              delete_rule as ondelete,
              update_rule as onupdate,
                concat(con.conname,con.conrelid,con.confrelid) as object_id
               FROM (
                   SELECT
                     unnest(con1.conkey) AS parent,
                     unnest(con1.confkey) AS child,
                     con1.confrelid,
                     con1.conrelid,
                     cl_1.relname,
                   con1.conname,
                   nspname
                   FROM
                     pg_class cl_1,
                     pg_namespace ns,
                     pg_constraint con1
                   WHERE
                     con1.contype = 'f'::"char"
                     AND cl_1.relnamespace = ns.oid
                     AND con1.conrelid = cl_1.oid
                     and nspname in (${schema})
              ) con,
                pg_attribute att,
                pg_class cl,
                pg_attribute att2,
                information_schema.referential_constraints rc
              WHERE
                att.attrelid = con.confrelid
                AND att.attnum = con.child
                AND cl.oid = con.confrelid
                AND att2.attrelid = con.conrelid
                AND att2.attnum = con.parent
                AND rc.constraint_name= con.conname AND constraint_catalog=current_database() AND rc.constraint_schema=nspname
                `)).rows;
            const relationsTemp = [];
            response.forEach(resp => {
                let rels = relationsTemp.find(val => val.object_id === resp.object_id);
                if (rels === undefined) {
                    rels = {};
                    rels.ownerColumnsNames = [];
                    rels.referencedColumnsNames = [];
                    rels.actionOnDelete =
                        resp.ondelete === "NO ACTION" ? null : resp.ondelete;
                    rels.actionOnUpdate =
                        resp.onupdate === "NO ACTION" ? null : resp.onupdate;
                    rels.object_id = resp.object_id;
                    rels.ownerTable = resp.tablewithforeignkey;
                    rels.referencedTable = resp.tablereferenced;
                    relationsTemp.push(rels);
                }
                rels.ownerColumnsNames.push(resp.foreignkeycolumn);
                rels.referencedColumnsNames.push(resp.foreignkeycolumnreferenced);
            });
            entities = this.GetRelationsFromRelationTempInfo(relationsTemp, entities);
            return entities;
        });
    }
    DisconnectFromServer() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.Connection) {
                const promise = new Promise((resolve, reject) => {
                    this.Connection.end(err => {
                        if (!err) {
                            resolve(true);
                        }
                        else {
                            TomgUtils.LogError("Error connecting to Postgres Server.", false, err.message);
                            reject(err);
                        }
                    });
                });
                yield promise;
            }
        });
    }
    ConnectToServer(connectionOptons) {
        return __awaiter(this, void 0, void 0, function* () {
            this.Connection = new PG.Client({
                database: connectionOptons.databaseName,
                host: connectionOptons.host,
                password: connectionOptons.password,
                port: connectionOptons.port,
                ssl: connectionOptons.ssl,
                user: connectionOptons.user
            });
            const promise = new Promise((resolve, reject) => {
                this.Connection.connect(err => {
                    if (!err) {
                        resolve(true);
                    }
                    else {
                        TomgUtils.LogError("Error connecting to Postgres Server.", false, err.message);
                        reject(err);
                    }
                });
            });
            yield promise;
        });
    }
    CreateDB(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.Connection.query(`CREATE DATABASE ${dbName}; `);
        });
    }
    UseDB(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.Connection.query(`USE ${dbName}; `);
        });
    }
    DropDB(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.Connection.query(`DROP DATABASE ${dbName}; `);
        });
    }
    CheckIfDBExists(dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = yield this.Connection.query(`SELECT datname FROM pg_database  WHERE datname  ='${dbName}' `);
            return resp.rowCount > 0;
        });
    }
    ReturnDefaultValueFunction(defVal) {
        if (!defVal) {
            return null;
        }
        defVal = defVal.replace(/'::[\w ]*/, "'");
        if (defVal.startsWith(`'`)) {
            return `() => "${defVal}"`;
        }
        return `() => "${defVal}"`;
    }
}
exports.PostgresDriver = PostgresDriver;
//# sourceMappingURL=PostgresDriver.js.map