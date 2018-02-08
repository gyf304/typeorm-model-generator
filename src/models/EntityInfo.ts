import { ColumnInfo } from "./ColumnInfo";
import * as Handlebars from "handlebars";

/**
 * EntityInfo
 */
export class EntityInfo {
    EntityName: string;
    Columns: ColumnInfo[];
    Imports: string[];
    UniqueImports: string[];
    Indexes: IndexInfo[];

    imports(): any {
        var returnString = "";
        var imports: string[] = [];
        this.Columns.forEach(column => {
            column.relations.forEach(relation => {
                if (this.EntityName != relation.relatedTable)
                    imports.push(relation.relatedTable);
            });

            if (column.ts_type && typeof column.ts_type !== "string") {
                imports.push(column.ts_type.name);
            }
        });
        this.UniqueImports = imports.filter(function(elem, index, self) {
            return index == self.indexOf(elem);
        });
    }
}
