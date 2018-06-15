"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Engine_1 = require("./Engine");
const Yargs = require("yargs");
const TomgUtils = require("./Utils");
const path = require("path");
var argv = Yargs.usage("Usage: typeorm-model-generator -h <host> -d <database> -p [port] -u <user> -x [password] -e [engine]")
    .option("h", {
    alias: "host",
    describe: "IP adress/Hostname for database server.",
    demand: true
})
    .option("d", {
    alias: "database",
    describe: "Database name.",
    demand: true
})
    .option("u", {
    alias: "user",
    describe: "Username for database server.",
    demand: true
})
    .option("x", {
    alias: "pass",
    describe: "Password for database server.",
    default: ""
})
    .option("p", {
    alias: "port",
    describe: "Port number for database server."
})
    .option("e", {
    alias: "engine",
    describe: "Database engine.",
    choices: ["mssql", "postgres", "mysql", "mariadb"],
    default: "mssql"
})
    .option("o", {
    alias: "output",
    describe: "Where to place generated models.",
    default: path.resolve(process.cwd(), "output")
})
    .option("s", {
    alias: "schema",
    describe: "Schema name to create model from. Only for mssql and postgres."
})
    .option("ssl", {
    boolean: true,
    default: false
})
    .option("noConfig", {
    boolean: true,
    describe: `Doesn't create tsconfig.json and ormconfig.json`,
    default: false
})
    .option("cf", {
    alias: "case-file",
    describe: "Convert file names to specified case",
    choices: ["pascal", "param", "camel", "none"],
    default: "none"
})
    .option("ce", {
    alias: "case-entity",
    describe: "Convert class names to specified case",
    choices: ["pascal", "camel", "none"],
    default: "none"
})
    .option("cp", {
    alias: "case-property",
    describe: "Convert property names to specified case",
    choices: ["pascal", "camel", "none"],
    default: "none"
})
    .option("ri", {
    alias: "remove-id",
    describe: "Remove _id suffix from fields",
    default: false
})
    .option("lazy", {
    describe: "Use lazy loads between fields with relationsips",
    default: false
}).argv;
var driver;
var standardPort;
var standardSchema = "";
switch (argv.e) {
    case "mssql":
        driver = new (require("./drivers/MssqlDriver").MssqlDriver)();
        standardPort = 1433;
        standardSchema = "dbo";
        break;
    case "postgres":
        driver = new (require("./drivers/PostgresDriver").PostgresDriver)();
        standardPort = 5432;
        standardSchema = "public";
        break;
    case "mysql":
        driver = new (require("./drivers/MysqlDriver").MysqlDriver)();
        standardPort = 3306;
        break;
    case "mariadb":
        driver = new (require("./drivers/MariaDbDriver").MariaDbDriver)();
        standardPort = 3306;
        break;
    case "oracle":
        driver = new (require("./drivers/OracleDriver").OracleDriver)();
        standardPort = 1521;
        break;
    default:
        TomgUtils.LogFatalError("Database engine not recognized.", false);
        throw new Error("Database engine not recognized.");
}
let engine = new Engine_1.Engine(driver, {
    host: argv.h,
    port: parseInt(argv.p) || standardPort,
    databaseName: argv.d,
    user: argv.u,
    password: argv.x,
    databaseType: argv.e,
    resultsPath: argv.o,
    schemaName: argv.s || standardSchema,
    ssl: argv.ssl,
    noConfigs: argv.noConfig,
    convertCaseFile: argv.cf,
    convertCaseEntity: argv.ce,
    convertCaseProperty: argv.cp,
    removeIdSuffix: argv.ri,
    lazy: argv.lazy
});
console.log(`[${new Date().toLocaleTimeString()}] Starting creation of model classes.`);
engine.createModelFromDatabase().then(() => {
    console.info(`[${new Date().toLocaleTimeString()}] Typeorm model classes created.`);
});
//# sourceMappingURL=index.js.map