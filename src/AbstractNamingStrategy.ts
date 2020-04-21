import { EntityInfo } from "./models/EntityInfo";
import { RelationInfo } from "./models/RelationInfo";

export abstract class AbstractNamingStrategy {
    public abstract relationName(
        columnName: string,
        relation: RelationInfo,
        entity: EntityInfo
    ): string;

    public abstract entityName(entityName: string): string;

    public abstract columnName(columnName: string): string;
}
