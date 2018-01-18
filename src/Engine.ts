import { AbstractDriver } from "./drivers/AbstractDriver";
import { DatabaseModel } from './models/DatabaseModel'
import * as Handlebars from 'handlebars'
import fs = require('fs');
import path = require('path')
import * as TomgUtils from './Utils'
import changeCase = require("change-case");
/**
 * Engine
 */
export class Engine {
    constructor(private driver: AbstractDriver, public Options: EngineOptions) {
    }

    public async createModelFromDatabase(): Promise<boolean> {
        let dbModel = await this.getEntitiesInfo(this.Options.databaseName, this.Options.host, this.Options.port, this.Options.user, this.Options.password, this.Options.schemaName, this.Options.ssl);
        if (dbModel.entities.length > 0) {
            this.createModelFromMetadata(dbModel);
        } else {
            TomgUtils.LogFatalError('Tables not found in selected database. Skipping creation of typeorm model.', false);
        }
        return true;
    }
    private async getEntitiesInfo(database: string, server: string, port: number, user: string, password: string, schemaName: string, ssl: boolean): Promise<DatabaseModel> {
        return await this.driver.GetDataFromServer(database, server, port, user, password, schemaName, ssl)

    }
    private createModelFromMetadata(databaseModel: DatabaseModel) {
        Handlebars.registerHelper("curly", (open) => {return open ? "{" : "}";});
        Handlebars.registerHelper("toEntityName", str => {return this.Options.convertCase ? changeCase.pascalCase(str) : str;});
        Handlebars.registerHelper("toFileName", str => {return this.Options.convertCase ? changeCase.paramCase(str) : str;});
        Handlebars.registerHelper("toPropertyName", str => {return this.Options.convertCase ? changeCase.camelCase(str) : str;});
        let templatePath = path.resolve(__dirname, '../../src/entity.mst')
        let template = fs.readFileSync(templatePath, 'UTF-8');
        let resultPath = this.Options.resultsPath
        if (!fs.existsSync(resultPath))
            fs.mkdirSync(resultPath);
        let entitesPath = resultPath
        if (!this.Options.noConfigs) {
            this.createTsConfigFile(resultPath)
            this.createTypeOrmConfig(resultPath)
            entitesPath = path.resolve(resultPath, './entities')
            if (!fs.existsSync(entitesPath))
                fs.mkdirSync(entitesPath);
        }
        Handlebars.registerHelper('toLowerCase', function (str) {
            return str.toLowerCase();
        });
        let compliedTemplate = Handlebars.compile(template, { noEscape: true })
        databaseModel.entities.forEach(element => {
            element.Imports = [];
            element.Columns.forEach((column) => {
                column.relations.forEach(
                    (relation) => {
                        if (element.EntityName !== relation.relatedTable)
                        {element.Imports.push(relation.relatedTable);}
                    }
                );
            });
            element.Imports.filter(function (elem, index, self) {
                return index === self.indexOf(elem);
            });
            let resultFilePath = path.resolve(entitesPath, (this.Options.convertCase ? changeCase.paramCase(element.EntityName) : element.EntityName) + '.ts');
            let rendered =compliedTemplate(element)
            fs.writeFileSync(resultFilePath, rendered, { encoding: 'UTF-8', flag: 'w' })
        });
    }
    //TODO:Move to mustache template file
    private createTsConfigFile(resultPath) {
        fs.writeFileSync(path.resolve(resultPath, 'tsconfig.json'), `{"compilerOptions": {
        "lib": ["es5", "es6"],
        "target": "es6",
        "module": "commonjs",
        "moduleResolution": "node",
        "emitDecoratorMetadata": true,
        "experimentalDecorators": true,
        "sourceMap": true
    }}`, { encoding: 'UTF-8', flag: 'w' });
    }
    private createTypeOrmConfig(resultPath) {
        if (this.Options.schemaName == '') {
            fs.writeFileSync(path.resolve(resultPath, 'ormconfig.json'), `[
  {
    "name": "default",
    "driver": {
      "type": "${this.Options.databaseType}",
      "host": "${this.Options.host}",
      "port": ${this.Options.port},
      "username": "${this.Options.user}",
      "password": "${this.Options.password}",
      "database": "${this.Options.databaseName}"
    },
    "entities": [
      "entities/*.js"
    ]
  }
]`, { encoding: 'UTF-8', flag: 'w' });
        }
        else {
            fs.writeFileSync(path.resolve(resultPath, 'ormconfig.json'), `[
  {
    "name": "default",
    "driver": {
      "type": "${this.Options.databaseType}",
      "host": "${this.Options.host}",
      "port": ${this.Options.port},
      "username": "${this.Options.user}",
      "password": "${this.Options.password}",
      "database": "${this.Options.databaseName}",
      "schema": "${this.Options.schemaName}"
    },
    "entities": [
      "entities/*.js"
    ]
  }
]`, { encoding: 'UTF-8', flag: 'w' });
        }
    }

}
export interface EngineOptions {
    host: string,
    port: number,
    databaseName: string,
    user: string,
    password: string,
    resultsPath: string,
    databaseType: string,
    schemaName: string,
    ssl: boolean,
    noConfigs: boolean,
    convertCase: boolean
}
