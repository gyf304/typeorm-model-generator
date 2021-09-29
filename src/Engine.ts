import changeCase = require("change-case");
import fs = require("fs");
import * as Handlebars from "handlebars";
import path = require("path");
import { DataTypeDefaults } from "typeorm/driver/types/DataTypeDefaults";
import { AbstractDriver } from "./drivers/AbstractDriver";
import { IConnectionOptions } from "./IConnectionOptions";
import { IGenerationOptions } from "./IGenerationOptions";
import { EntityInfo } from "./models/EntityInfo";
import { EnumInfo } from "./models/EnumInfo";
import { NamingStrategy } from "./NamingStrategy";
import * as TomgUtils from "./Utils";

export function createDriver(driverName: string): AbstractDriver {
    switch (driverName) {
        case "mssql":
            return new (require("./drivers/MssqlDriver")).MssqlDriver();
        case "postgres":
            return new (require("./drivers/PostgresDriver")).PostgresDriver();
        case "mysql":
            return new (require("./drivers/MysqlDriver")).MysqlDriver();
        case "mariadb":
            return new (require("./drivers/MariaDbDriver")).MariaDbDriver();
        case "oracle":
            return new (require("./drivers/OracleDriver")).OracleDriver();
        case "sqlite":
            return new (require("./drivers/SqliteDriver")).SqliteDriver();
        default:
            TomgUtils.LogError("Database engine not recognized.", false);
            throw new Error("Database engine not recognized.");
    }
}

export async function createModelFromDatabase(
    driver: AbstractDriver,
    connectionOptions: IConnectionOptions,
    generationOptions: IGenerationOptions
) {
    let [dbModel, customTypes] = await dataCollectionPhase(
        driver,
        connectionOptions
    );
    if (dbModel.length === 0) {
        TomgUtils.LogError(
            "Tables not found in selected database. Skipping creation of typeorm model.",
            false
        );
        return;
    }
    dbModel = modelCustomizationPhase(
        dbModel,
        generationOptions,
        driver.defaultValues
    );
    modelGenerationPhase(
        connectionOptions,
        generationOptions,
        dbModel,
        customTypes
    );
}
export async function dataCollectionPhase(
    driver: AbstractDriver,
    connectionOptions: IConnectionOptions
) {
    return await driver.GetDataFromServer(connectionOptions);
}

export function modelCustomizationPhase(
    dbModel: EntityInfo[],
    generationOptions: IGenerationOptions,
    defaultValues: DataTypeDefaults
) {
    let namingStrategy: NamingStrategy;
    if (
        generationOptions.customNamingStrategyPath &&
        generationOptions.customNamingStrategyPath !== ""
    ) {
        // tslint:disable-next-line:no-var-requires
        const req = require(generationOptions.customNamingStrategyPath);
        namingStrategy = new req.NamingStrategy();
    } else {
        namingStrategy = new NamingStrategy();
    }
    dbModel = setRelationId(generationOptions, dbModel);
    dbModel = applyNamingStrategy(namingStrategy, dbModel);
    dbModel = addImportsAndGenerationOptions(dbModel, generationOptions);
    dbModel = removeColumnDefaultProperties(dbModel, defaultValues);
    return dbModel;
}
function removeColumnDefaultProperties(
    dbModel: EntityInfo[],
    defaultValues: DataTypeDefaults
) {
    if (!defaultValues) {
        return dbModel;
    }
    dbModel.forEach(entity => {
        entity.Columns.forEach(column => {
            const defVal = defaultValues[column.options.type as any];
            if (defVal) {
                if (
                    column.options.length &&
                    defVal.length &&
                    column.options.length === defVal.length
                ) {
                    column.options.length = undefined;
                }
                if (
                    column.options.precision &&
                    defVal.precision &&
                    column.options.precision === defVal.precision
                ) {
                    column.options.precision = undefined;
                }
                if (
                    column.options.scale &&
                    defVal.scale &&
                    column.options.scale === defVal.scale
                ) {
                    column.options.scale = undefined;
                }
                if (
                    column.options.width &&
                    defVal.width &&
                    column.options.width === defVal.width
                ) {
                    column.options.width = undefined;
                }
            }
        });
    });
    return dbModel;
}
function addImportsAndGenerationOptions(
    dbModel: EntityInfo[],
    generationOptions: IGenerationOptions
) {
    dbModel.forEach(element => {
        element.Imports = [];
        element.Columns.forEach(column => {
            if (column.isCustomType) {
                element.Imports.push(column.tsType);
            }
            column.relations.forEach(relation => {
                if (element.tsEntityName !== relation.relatedTable) {
                    element.Imports.push(relation.relatedTable);
                }
            });
        });
        element.GenerateConstructor = generationOptions.generateConstructor;
        element.IsActiveRecord = generationOptions.activeRecord;
        element.Imports.filter((elem, index, self) => {
            return index === self.indexOf(elem);
        });
    });
    return dbModel;
}

function setRelationId(
    generationOptions: IGenerationOptions,
    model: EntityInfo[]
) {
    if (generationOptions.relationIds) {
        model.forEach(ent => {
            ent.Columns.forEach(col => {
                col.relations.map(rel => {
                    rel.relationIdField = rel.isOwner;
                });
            });
        });
    }
    return model;
}
export function modelGenerationPhase(
    connectionOptions: IConnectionOptions,
    generationOptions: IGenerationOptions,
    databaseModel: EntityInfo[],
    customTypes: EnumInfo[]
) {
    createHandlebarsHelpers(generationOptions);
    const templatePath = path.resolve(__dirname, "../../src/entity.mst");
    const template = fs.readFileSync(templatePath, "UTF-8");
    const resultPath = generationOptions.resultsPath;
    if (!fs.existsSync(resultPath)) {
        fs.mkdirSync(resultPath);
    }
    let entitesPath = resultPath;
    if (!generationOptions.noConfigs) {
        createTsConfigFile(resultPath);
        createTypeOrmConfig(resultPath, connectionOptions);
        entitesPath = path.resolve(resultPath, "./entities");
        if (!fs.existsSync(entitesPath)) {
            fs.mkdirSync(entitesPath);
        }
    }
    const compliedTemplate = Handlebars.compile(template, {
        noEscape: true
    });
    databaseModel.forEach(element => {
        let casedFileName = "";
        switch (generationOptions.convertCaseFile) {
            case "camel":
                casedFileName = changeCase.camelCase(element.tsEntityName);
                break;
            case "param":
                casedFileName = changeCase.paramCase(element.tsEntityName);
                break;
            case "pascal":
                casedFileName = changeCase.pascalCase(element.tsEntityName);
                break;
            case "none":
                casedFileName = element.tsEntityName;
                break;
        }
        const resultFilePath = path.resolve(entitesPath, casedFileName + ".ts");
        const rendered = compliedTemplate(element);
        fs.writeFileSync(resultFilePath, rendered, {
            encoding: "UTF-8",
            flag: "w"
        });
    });
    const enumTemplatePath = path.resolve(__dirname, "../../src/enum.mst");
    const enumTemplate = fs.readFileSync(enumTemplatePath, "UTF-8");
    const compiledEnumTemplate = Handlebars.compile(enumTemplate, {
        noEscape: true
    });
    customTypes.forEach(en => {
        const rendered = compiledEnumTemplate(en);
        let casedFileName = "";
        switch (generationOptions.convertCaseFile) {
            case "camel":
                casedFileName = changeCase.camelCase(en.name);
                break;
            case "param":
                casedFileName = changeCase.paramCase(en.name);
                break;
            case "pascal":
                casedFileName = changeCase.pascalCase(en.name);
                break;
            case "none":
                casedFileName = en.name;
                break;
        }
        const resultFilePath = path.resolve(entitesPath, casedFileName + ".ts");
        fs.writeFileSync(resultFilePath, rendered, {
            encoding: "UTF-8",
            flag: "w"
        });
    });
}

function createHandlebarsHelpers(generationOptions: IGenerationOptions) {
    Handlebars.registerHelper("curly", open => (open ? "{" : "}"));
    Handlebars.registerHelper("toEntityName", str => {
        let retStr = "";
        switch (generationOptions.convertCaseEntity) {
            case "camel":
                retStr = changeCase.camelCase(str);
                break;
            case "pascal":
                retStr = changeCase.pascalCase(str);
                break;
            case "none":
                retStr = str;
                break;
        }
        // console.log(str, '-->', retStr);
        return retStr;
    });
    Handlebars.registerHelper("concat", (stra, strb) => {
        return stra + strb;
    });
    Handlebars.registerHelper("toFileName", str => {
        let retStr = "";
        switch (generationOptions.convertCaseFile) {
            case "camel":
                retStr = changeCase.camelCase(str);
                break;
            case "param":
                retStr = changeCase.paramCase(str);
                break;
            case "pascal":
                retStr = changeCase.pascalCase(str);
                break;
            case "none":
                retStr = str;
                break;
        }
        return retStr;
    });
    Handlebars.registerHelper("printPropertyVisibility", () =>
        generationOptions.propertyVisibility !== "none"
            ? generationOptions.propertyVisibility + " "
            : ""
    );
    Handlebars.registerHelper("toPropertyName", str => {
        let retStr = "";
        switch (generationOptions.convertCaseProperty) {
            case "camel":
                retStr = changeCase.camelCase(str);
                break;
            case "pascal":
                retStr = changeCase.pascalCase(str);
                break;
            case "none":
                retStr = str;
                break;
        }
        return retStr;
    });
    Handlebars.registerHelper("toLowerCase", str => str.toLowerCase());
    Handlebars.registerHelper("tolowerCaseFirst", str =>
        changeCase.lowerCaseFirst(str)
    );
    Handlebars.registerHelper("toLazy", str => {
        if (generationOptions.lazy) {
            return `Promise<${str}>`;
        } else {
            return str;
        }
    });
    Handlebars.registerHelper("constantCase", str =>
        changeCase.constantCase(str)
    );
    Handlebars.registerHelper({
        and: (v1, v2) => v1 && v2,
        eq: (v1, v2) => v1 === v2,
        gt: (v1, v2) => v1 > v2,
        gte: (v1, v2) => v1 >= v2,
        lt: (v1, v2) => v1 < v2,
        lte: (v1, v2) => v1 <= v2,
        ne: (v1, v2) => v1 !== v2,
        or: (v1, v2) => v1 || v2
    });
}

// TODO:Move to mustache template file
function createTsConfigFile(resultPath) {
    fs.writeFileSync(
        path.resolve(resultPath, "tsconfig.json"),
        `{"compilerOptions": {
        "lib": ["es5", "es6"],
        "target": "es6",
        "module": "commonjs",
        "moduleResolution": "node",
        "emitDecoratorMetadata": true,
        "experimentalDecorators": true,
        "sourceMap": true
    }}`,
        { encoding: "UTF-8", flag: "w" }
    );
}
function createTypeOrmConfig(
    resultPath: string,
    connectionOptions: IConnectionOptions
) {
    if (connectionOptions.schemaName === "") {
        fs.writeFileSync(
            path.resolve(resultPath, "ormconfig.json"),
            `[
  {
    "name": "default",
    "type": "${connectionOptions.databaseType}",
    "host": "${connectionOptions.host}",
    "port": ${connectionOptions.port},
    "username": "${connectionOptions.user}",
    "password": "${connectionOptions.password}",
    "database": "${connectionOptions.databaseName}",
    "synchronize": false,
    "entities": [
      "entities/*.js"
    ]
  }
]`,
            { encoding: "UTF-8", flag: "w" }
        );
    } else {
        fs.writeFileSync(
            path.resolve(resultPath, "ormconfig.json"),
            `[
  {
    "name": "default",
    "type": "${connectionOptions.databaseType}",
    "host": "${connectionOptions.host}",
    "port": ${connectionOptions.port},
    "username": "${connectionOptions.user}",
    "password": "${connectionOptions.password}",
    "database": "${connectionOptions.databaseName}",
    "schema": "${connectionOptions.schemaName}",
    "synchronize": false,
    "entities": [
      "entities/*.js"
    ]
  }
]`,
            { encoding: "UTF-8", flag: "w" }
        );
    }
}
function applyNamingStrategy(
    namingStrategy: NamingStrategy,
    dbModel: EntityInfo[]
) {
    dbModel = changeRelationNames(dbModel);
    dbModel = changeEntityNames(dbModel);
    dbModel = changeColumnNames(dbModel);
    return dbModel;

    function changeRelationNames(model: EntityInfo[]) {
        model.forEach(entity => {
            entity.Columns.forEach(column => {
                column.relations.forEach(relation => {
                    const newName = namingStrategy.relationName(
                        column.tsName,
                        relation,
                        entity
                    );
                    model.forEach(entity2 => {
                        entity2.Columns.forEach(column2 => {
                            column2.relations.forEach(relation2 => {
                                if (
                                    relation2.relatedTable ===
                                        entity.tsEntityName &&
                                    relation2.ownerColumn === column.tsName
                                ) {
                                    relation2.ownerColumn = newName;
                                }
                                if (
                                    relation2.relatedTable ===
                                        entity.tsEntityName &&
                                    relation2.relatedColumn === column.tsName
                                ) {
                                    relation2.relatedColumn = newName;
                                }
                                if (relation.isOwner) {
                                    entity.Indexes.forEach(ind => {
                                        ind.columns
                                            .filter(
                                                col =>
                                                    col.name === column.tsName
                                            )
                                            .forEach(
                                                col => (col.name = newName)
                                            );
                                    });
                                }
                            });
                        });
                    });
                    column.tsName = newName;
                });
            });
        });
        return dbModel;
    }

    function changeColumnNames(model: EntityInfo[]) {
        model.forEach(entity => {
            entity.Columns.forEach(column => {
                const newName = namingStrategy.columnName(column.tsName);
                entity.Indexes.forEach(index => {
                    index.columns
                        .filter(column2 => column2.name === column.tsName)
                        .forEach(column2 => (column2.name = newName));
                });
                model.forEach(entity2 => {
                    entity2.Columns.forEach(column2 => {
                        column2.relations
                            .filter(
                                relation =>
                                    relation.relatedTable ===
                                        entity.tsEntityName &&
                                    relation.relatedColumn === column.tsName
                            )
                            .map(v => (v.relatedColumn = newName));
                        column2.relations
                            .filter(
                                relation =>
                                    relation.relatedTable ===
                                        entity.tsEntityName &&
                                    relation.ownerColumn === column.tsName
                            )
                            .map(v => (v.ownerColumn = newName));
                    });
                });

                column.tsName = newName;
            });
        });
        return model;
    }
    function changeEntityNames(entities: EntityInfo[]) {
        entities.forEach(entity => {
            const newName = namingStrategy.entityName(entity.tsEntityName);
            entities.forEach(entity2 => {
                entity2.Columns.forEach(column => {
                    column.relations.forEach(relation => {
                        if (relation.ownerTable === entity.tsEntityName) {
                            relation.ownerTable = newName;
                        }
                        if (relation.relatedTable === entity.tsEntityName) {
                            relation.relatedTable = newName;
                        }
                    });
                });
            });
            entity.tsEntityName = newName;
        });
        return entities;
    }
}
