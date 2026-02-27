import { Data } from "effect";

export class ParseError extends Data.TaggedError("ParseError")<{
  message: string;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  message: string;
  cause?: unknown;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  message: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string;
}> {}
