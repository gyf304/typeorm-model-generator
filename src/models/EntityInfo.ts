import { ColumnInfo } from "./ColumnInfo";

export class EntityInfo {
    public tsEntityName: string;
    public sqlEntityName: string;
    public Columns: ColumnInfo[];
    public Imports: string[];
    public Indexes: IndexInfo[];
    public Schema: string;
    public GenerateConstructor: boolean;
    public IsActiveRecord: boolean;
    public Database: string;
    public Type?: "BASE TABLE" | "VIEW";

    public get UniqueImports() {
        const imports: string[] = [];
        this.Columns.forEach(column => {
            if (column.isCustomType) {
                imports.push(column.tsType);
            }
            column.relations.forEach(relation => {
                if (this.tsEntityName !== relation.relatedTable) {
                    imports.push(relation.relatedTable);
                }
            });
        });
        return imports.filter(
            (elem, index, self) => index === self.indexOf(elem)
        );
    }
}
