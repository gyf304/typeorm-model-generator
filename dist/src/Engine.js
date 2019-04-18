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
const fs = require("fs");
const Handlebars = require("handlebars");
const path = require("path");
const MariaDbDriver_1 = require("./drivers/MariaDbDriver");
const MssqlDriver_1 = require("./drivers/MssqlDriver");
const MysqlDriver_1 = require("./drivers/MysqlDriver");
const OracleDriver_1 = require("./drivers/OracleDriver");
const PostgresDriver_1 = require("./drivers/PostgresDriver");
const SqliteDriver_1 = require("./drivers/SqliteDriver");
const NamingStrategy_1 = require("./NamingStrategy");
const TomgUtils = require("./Utils");
function createDriver(driverName) {
    switch (driverName) {
        case "mssql":
            return new MssqlDriver_1.MssqlDriver();
        case "postgres":
            return new PostgresDriver_1.PostgresDriver();
        case "mysql":
            return new MysqlDriver_1.MysqlDriver();
        case "mariadb":
            return new MariaDbDriver_1.MariaDbDriver();
        case "oracle":
            return new OracleDriver_1.OracleDriver();
        case "sqlite":
            return new SqliteDriver_1.SqliteDriver();
        default:
            TomgUtils.LogError("Database engine not recognized.", false);
            throw new Error("Database engine not recognized.");
    }
}
exports.createDriver = createDriver;
function createModelFromDatabase(driver, connectionOptions, generationOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        let [dbModel, customTypes] = yield dataCollectionPhase(driver, connectionOptions);
        if (dbModel.length === 0) {
            TomgUtils.LogError("Tables not found in selected database. Skipping creation of typeorm model.", false);
            return;
        }
        dbModel = modelCustomizationPhase(dbModel, generationOptions, driver.defaultValues);
        modelGenerationPhase(connectionOptions, generationOptions, dbModel, customTypes);
    });
}
exports.createModelFromDatabase = createModelFromDatabase;
function dataCollectionPhase(driver, connectionOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield driver.GetDataFromServer(connectionOptions);
    });
}
exports.dataCollectionPhase = dataCollectionPhase;
function modelCustomizationPhase(dbModel, generationOptions, defaultValues) {
    let namingStrategy;
    if (generationOptions.customNamingStrategyPath &&
        generationOptions.customNamingStrategyPath !== "") {
        // tslint:disable-next-line:no-var-requires
        const req = require(generationOptions.customNamingStrategyPath);
        namingStrategy = new req.NamingStrategy();
    }
    else {
        namingStrategy = new NamingStrategy_1.NamingStrategy();
    }
    dbModel = setRelationId(generationOptions, dbModel);
    dbModel = applyNamingStrategy(namingStrategy, dbModel);
    dbModel = addImportsAndGenerationOptions(dbModel, generationOptions);
    dbModel = removeColumnDefaultProperties(dbModel, defaultValues);
    return dbModel;
}
exports.modelCustomizationPhase = modelCustomizationPhase;
function removeColumnDefaultProperties(dbModel, defaultValues) {
    if (!defaultValues) {
        return dbModel;
    }
    dbModel.forEach(entity => {
        entity.Columns.forEach(column => {
            const defVal = defaultValues[column.options.type];
            if (defVal) {
                if (column.options.length &&
                    defVal.length &&
                    column.options.length === defVal.length) {
                    column.options.length = undefined;
                }
                if (column.options.precision &&
                    defVal.precision &&
                    column.options.precision === defVal.precision) {
                    column.options.precision = undefined;
                }
                if (column.options.scale &&
                    defVal.scale &&
                    column.options.scale === defVal.scale) {
                    column.options.scale = undefined;
                }
                if (column.options.width &&
                    defVal.width &&
                    column.options.width === defVal.width) {
                    column.options.width = undefined;
                }
            }
        });
    });
    return dbModel;
}
function addImportsAndGenerationOptions(dbModel, generationOptions) {
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
function setRelationId(generationOptions, model) {
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
function modelGenerationPhase(connectionOptions, generationOptions, databaseModel, customTypes) {
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
exports.modelGenerationPhase = modelGenerationPhase;
function createHandlebarsHelpers(generationOptions) {
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
    Handlebars.registerHelper("printPropertyVisibility", () => generationOptions.propertyVisibility !== "none"
        ? generationOptions.propertyVisibility + " "
        : "");
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
    Handlebars.registerHelper("tolowerCaseFirst", str => changeCase.lowerCaseFirst(str));
    Handlebars.registerHelper("toLazy", str => {
        if (generationOptions.lazy) {
            return `Promise<${str}>`;
        }
        else {
            return str;
        }
    });
    Handlebars.registerHelper("constantCase", str => changeCase.constantCase(str));
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
    fs.writeFileSync(path.resolve(resultPath, "tsconfig.json"), `{"compilerOptions": {
        "lib": ["es5", "es6"],
        "target": "es6",
        "module": "commonjs",
        "moduleResolution": "node",
        "emitDecoratorMetadata": true,
        "experimentalDecorators": true,
        "sourceMap": true
    }}`, { encoding: "UTF-8", flag: "w" });
}
function createTypeOrmConfig(resultPath, connectionOptions) {
    if (connectionOptions.schemaName === "") {
        fs.writeFileSync(path.resolve(resultPath, "ormconfig.json"), `[
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
]`, { encoding: "UTF-8", flag: "w" });
    }
    else {
        fs.writeFileSync(path.resolve(resultPath, "ormconfig.json"), `[
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
]`, { encoding: "UTF-8", flag: "w" });
    }
}
function applyNamingStrategy(namingStrategy, dbModel) {
    dbModel = changeRelationNames(dbModel);
    dbModel = changeEntityNames(dbModel);
    dbModel = changeColumnNames(dbModel);
    return dbModel;
    function changeRelationNames(model) {
        model.forEach(entity => {
            entity.Columns.forEach(column => {
                column.relations.forEach(relation => {
                    const newName = namingStrategy.relationName(column.tsName, relation, model);
                    model.forEach(entity2 => {
                        entity2.Columns.forEach(column2 => {
                            column2.relations.forEach(relation2 => {
                                if (relation2.relatedTable ===
                                    entity.tsEntityName &&
                                    relation2.ownerColumn === column.tsName) {
                                    relation2.ownerColumn = newName;
                                }
                                if (relation2.relatedTable ===
                                    entity.tsEntityName &&
                                    relation2.relatedColumn === column.tsName) {
                                    relation2.relatedColumn = newName;
                                }
                                if (relation.isOwner) {
                                    entity.Indexes.forEach(ind => {
                                        ind.columns
                                            .filter(col => col.name === column.tsName)
                                            .forEach(col => (col.name = newName));
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
    function changeColumnNames(model) {
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
                            .filter(relation => relation.relatedTable ===
                            entity.tsEntityName &&
                            relation.relatedColumn === column.tsName)
                            .map(v => (v.relatedColumn = newName));
                        column2.relations
                            .filter(relation => relation.relatedTable ===
                            entity.tsEntityName &&
                            relation.ownerColumn === column.tsName)
                            .map(v => (v.ownerColumn = newName));
                    });
                });
                column.tsName = newName;
            });
        });
        return model;
    }
    function changeEntityNames(entities) {
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
//# sourceMappingURL=Engine.js.map