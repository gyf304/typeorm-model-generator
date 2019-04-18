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
const fs = require("fs-extra");
const inquirer = require("inquirer");
const path = require("path");
const Yargs = require("yargs");
const Engine_1 = require("./Engine");
const IConnectionOptions_1 = require("./IConnectionOptions");
const IGenerationOptions_1 = require("./IGenerationOptions");
const TomgUtils = require("./Utils");
CliLogic();
function CliLogic() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(TomgUtils.packageVersion());
        let driver;
        let connectionOptions;
        let generationOptions;
        if (process.argv.length > 2) {
            const retVal = GetUtilParametersByArgs();
            connectionOptions = retVal.connectionOptions;
            generationOptions = retVal.generationOptions;
            driver = retVal.driver;
        }
        else {
            if (fs.existsSync(path.resolve(process.cwd(), ".tomg-config"))) {
                console.log(`[${new Date().toLocaleTimeString()}] Using configuration file. [${path.resolve(process.cwd(), ".tomg-config")}]`);
                const retVal = yield fs.readJson(path.resolve(process.cwd(), ".tomg-config"));
                connectionOptions = retVal[0];
                generationOptions = retVal[1];
                driver = Engine_1.createDriver(connectionOptions.databaseType);
            }
            else {
                const retVal = yield GetUtilParametersByInquirer();
                driver = retVal.driver;
                connectionOptions = retVal.connectionOptions;
                generationOptions = retVal.generationOptions;
            }
        }
        console.log(`[${new Date().toLocaleTimeString()}] Starting creation of model classes.`);
        Engine_1.createModelFromDatabase(driver, connectionOptions, generationOptions).then(() => {
            console.info(`[${new Date().toLocaleTimeString()}] Typeorm model classes created.`);
        });
    });
}
function GetUtilParametersByArgs() {
    const argv = Yargs.usage("Usage: typeorm-model-generator -h <host> -d <database> -p [port] -u <user> -x [password] -e [engine]\nYou can also run program without specyfiying any parameters.")
        .option("h", {
        alias: "host",
        default: "127.0.0.1",
        describe: "IP adress/Hostname for database server"
    })
        .option("d", {
        alias: "database",
        demand: true,
        describe: "Database name(or path for sqlite). You can pass multiple values separted by comma."
    })
        .option("u", {
        alias: "user",
        describe: "Username for database server"
    })
        .option("x", {
        alias: "pass",
        default: "",
        describe: "Password for database server"
    })
        .option("p", {
        alias: "port",
        describe: "Port number for database server"
    })
        .option("e", {
        alias: "engine",
        choices: [
            "mssql",
            "postgres",
            "mysql",
            "mariadb",
            "oracle",
            "sqlite"
        ],
        default: "mssql",
        describe: "Database engine"
    })
        .option("o", {
        alias: "output",
        default: path.resolve(process.cwd(), "output"),
        describe: "Where to place generated models"
    })
        .option("s", {
        alias: "schema",
        describe: "Schema name to create model from. Only for mssql and postgres. You can pass multiple values separted by comma."
    })
        .option("ssl", {
        boolean: true,
        default: false
    })
        .option("noConfig", {
        boolean: true,
        default: false,
        describe: `Doesn't create tsconfig.json and ormconfig.json`
    })
        .option("cf", {
        alias: "case-file",
        choices: ["pascal", "param", "camel", "none"],
        default: "none",
        describe: "Convert file names to specified case"
    })
        .option("ce", {
        alias: "case-entity",
        choices: ["pascal", "camel", "none"],
        default: "none",
        describe: "Convert class names to specified case"
    })
        .option("cp", {
        alias: "case-property",
        choices: ["pascal", "camel", "none"],
        default: "none",
        describe: "Convert property names to specified case"
    })
        .option("pv", {
        alias: "property-visibility",
        choices: ["public", "protected", "private", "none"],
        default: "none",
        describe: "Defines which visibility should have the generated property"
    })
        .option("lazy", {
        boolean: true,
        default: false,
        describe: "Generate lazy relations"
    })
        .option("a", {
        alias: "active-record",
        boolean: true,
        default: false,
        describe: "Use ActiveRecord syntax for generated models"
    })
        .option("namingStrategy", {
        describe: "Use custom naming strategy"
    })
        .option("relationIds", {
        boolean: true,
        default: false,
        describe: "Generate RelationId fields"
    })
        .option("generateConstructor", {
        boolean: true,
        default: false,
        describe: "Generate constructor allowing partial initialization"
    }).argv;
    const driver = Engine_1.createDriver(argv.e);
    const standardPort = driver.standardPort;
    const standardSchema = driver.standardSchema;
    const standardUser = driver.standardPort;
    let namingStrategyPath;
    if (argv.namingStrategy && argv.namingStrategy !== "") {
        // tslint:disable-next-line:no-var-requires
        namingStrategyPath = argv.namingStrategy;
    }
    else {
        namingStrategyPath = "";
    }
    const connectionOptions = new IConnectionOptions_1.IConnectionOptions();
    (connectionOptions.databaseName = argv.d
        ? argv.d.toString()
        : ""),
        (connectionOptions.databaseType = argv.e),
        (connectionOptions.host = argv.h),
        (connectionOptions.password = argv.x ? argv.x.toString() : ""),
        (connectionOptions.port =
            parseInt(argv.p, 10) || standardPort),
        (connectionOptions.schemaName = argv.s
            ? argv.s.toString()
            : standardSchema),
        (connectionOptions.ssl = argv.ssl),
        (connectionOptions.user = argv.u
            ? argv.u.toString()
            : standardUser);
    const generationOptions = new IGenerationOptions_1.IGenerationOptions();
    (generationOptions.activeRecord = argv.a),
        (generationOptions.generateConstructor = argv.generateConstructor),
        (generationOptions.convertCaseEntity = argv.ce),
        (generationOptions.convertCaseFile = argv.cf),
        (generationOptions.convertCaseProperty = argv.cp),
        (generationOptions.lazy = argv.lazy),
        (generationOptions.customNamingStrategyPath = namingStrategyPath),
        (generationOptions.noConfigs = argv.noConfig),
        (generationOptions.propertyVisibility = argv.pv),
        (generationOptions.relationIds = argv.relationIds),
        (generationOptions.resultsPath = argv.o ? argv.o.toString() : "");
    return { driver, connectionOptions, generationOptions };
}
function GetUtilParametersByInquirer() {
    return __awaiter(this, void 0, void 0, function* () {
        const connectionOptions = new IConnectionOptions_1.IConnectionOptions();
        const generationOptions = new IGenerationOptions_1.IGenerationOptions();
        connectionOptions.databaseType = (yield inquirer.prompt([
            {
                choices: [
                    "mssql",
                    "postgres",
                    "mysql",
                    "mariadb",
                    "oracle",
                    "sqlite"
                ],
                message: "Choose database engine",
                name: "engine",
                type: "list"
            }
        ])).engine;
        const driver = Engine_1.createDriver(connectionOptions.databaseType);
        if (connectionOptions.databaseType !== "sqlite") {
            const answ = yield inquirer.prompt([
                {
                    default: "localhost",
                    message: "Database adress:",
                    name: "host",
                    type: "input"
                },
                {
                    message: "Database port:",
                    name: "port",
                    type: "input",
                    default(answers) {
                        return driver.standardPort;
                    },
                    validate(value) {
                        const valid = !isNaN(parseInt(value, 10));
                        return valid || "Please enter a valid port number";
                    }
                },
                {
                    default: false,
                    message: "Use SSL:",
                    name: "ssl",
                    type: "confirm"
                },
                {
                    message: "Database user name:",
                    name: "login",
                    type: "input",
                    default(answers) {
                        return driver.standardUser;
                    }
                },
                {
                    message: "Database user pasword:",
                    name: "password",
                    type: "password"
                },
                {
                    default: "",
                    message: "Database name: (You can pass multiple values separted by comma)",
                    name: "dbName",
                    type: "input"
                }
            ]);
            if (connectionOptions.databaseType === "mssql" ||
                connectionOptions.databaseType === "postgres") {
                connectionOptions.schemaName = (yield inquirer.prompt([
                    {
                        default: driver.standardSchema,
                        message: "Database schema: (You can pass multiple values separted by comma)",
                        name: "schema",
                        type: "input"
                    }
                ])).schema;
            }
            connectionOptions.port = answ.port;
            connectionOptions.host = answ.host;
            connectionOptions.user = answ.login;
            connectionOptions.password = answ.password;
            connectionOptions.databaseName = answ.dbName;
            connectionOptions.ssl = answ.ssl;
        }
        else {
            connectionOptions.databaseName = (yield inquirer.prompt([
                {
                    default: "",
                    message: "Path to database file:",
                    name: "dbName",
                    type: "input"
                }
            ])).dbName;
        }
        generationOptions.resultsPath = (yield inquirer.prompt([
            {
                default: path.resolve(process.cwd(), "output"),
                message: "Path where generated models should be stored:",
                name: "output",
                type: "input"
            }
        ])).output;
        const customize = (yield inquirer.prompt([
            {
                default: false,
                message: "Do you want to customize generated model?",
                name: "customize",
                type: "confirm"
            }
        ])).customize;
        if (customize) {
            const customizations = (yield inquirer.prompt([
                {
                    choices: [
                        {
                            checked: true,
                            name: "Generate config files",
                            value: "config"
                        },
                        {
                            name: "Generate lazy relations",
                            value: "lazy"
                        },
                        {
                            name: "Use ActiveRecord syntax for generated models",
                            value: "activeRecord"
                        },
                        {
                            name: "Use custom naming strategy",
                            value: "namingStrategy"
                        },
                        {
                            name: "Generate RelationId fields",
                            value: "relationId"
                        },
                        {
                            name: "Generate constructor allowing partial initialization",
                            value: "constructor"
                        },
                        {
                            name: "Use specific naming convention",
                            value: "namingConvention"
                        }
                    ],
                    message: "Avaliable customizations",
                    name: "selected",
                    type: "checkbox"
                }
            ])).selected;
            generationOptions.noConfigs = !customizations.includes("config");
            generationOptions.lazy = customizations.includes("lazy");
            generationOptions.activeRecord = customizations.includes("activeRecord");
            generationOptions.relationIds = customizations.includes("relationId");
            generationOptions.generateConstructor = customizations.includes("constructor");
            if (customizations.includes("namingStrategy")) {
                const namingStrategyPath = (yield inquirer.prompt([
                    {
                        default: path.resolve(process.cwd()),
                        message: "Path to custom naming stategy file:",
                        name: "namingStrategy",
                        type: "input",
                        validate(value) {
                            const valid = value === "" || fs.existsSync(value);
                            return (valid ||
                                "Please enter a a valid path to custom naming strategy file");
                        }
                    }
                ])).namingStrategy;
                if (namingStrategyPath && namingStrategyPath !== "") {
                    // tslint:disable-next-line:no-var-requires
                    generationOptions.customNamingStrategyPath = namingStrategyPath;
                }
                else {
                    generationOptions.customNamingStrategyPath = "";
                }
            }
            if (customizations.includes("namingConvention")) {
                const namingConventions = (yield inquirer.prompt([
                    {
                        choices: ["pascal", "param", "camel", "none"],
                        default: "none",
                        message: "Convert file names to specified case:",
                        name: "fileCase",
                        type: "list"
                    },
                    {
                        choices: ["pascal", "camel", "none"],
                        default: "none",
                        message: "Convert class names to specified case:",
                        name: "entityCase",
                        type: "list"
                    },
                    {
                        choices: ["pascal", "camel", "none"],
                        default: "none",
                        message: "Convert property names to specified case:",
                        name: "propertyCase",
                        type: "list"
                    }
                ]));
                generationOptions.convertCaseFile = namingConventions.fileCase;
                generationOptions.convertCaseProperty =
                    namingConventions.propertyCase;
                generationOptions.convertCaseEntity = namingConventions.entityCase;
            }
        }
        const saveConfig = (yield inquirer.prompt([
            {
                default: false,
                message: "Save configuration to config file?",
                name: "saveConfig",
                type: "confirm"
            }
        ])).saveConfig;
        if (saveConfig) {
            yield fs.writeJson(path.resolve(process.cwd(), ".tomg-config"), [connectionOptions, generationOptions], { spaces: "\t" });
            console.log(`[${new Date().toLocaleTimeString()}] Config file saved.`);
            console.warn(`\x1b[33m[${new Date().toLocaleTimeString()}] WARNING: Password was saved as plain text.\x1b[0m`);
        }
        return { driver, connectionOptions, generationOptions };
    });
}
//# sourceMappingURL=index.js.map