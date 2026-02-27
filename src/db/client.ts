import { Context } from "effect";

export class Database extends Context.Tag("Database")<Database, D1Database>() {}
