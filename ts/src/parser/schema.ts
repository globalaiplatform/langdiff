import { z, ZodSchema } from "zod";
import { Atom, StreamingAtomList, StreamingList, StreamingObject, StreamingString, StreamingValue } from "./model";

export type infer<T extends BaseSchema<any>> = T extends BaseSchema<infer U> ? U : never;

export abstract class BaseSchema<T extends StreamingValue<any>> {
  public description?: string;
  public defaultValue?: any;
  public customZodSchema?: z.ZodSchema<any>;

  abstract create(): T;

  describe(description: string) {
    if (this.customZodSchema) {
      throw new Error("Cannot set description when Zod schema is set");
    }
    this.description = description;
    return this;
  }

  default(value: any) {
    if (this.customZodSchema) {
      throw new Error("Cannot set default value when Zod schema is set");
    }
    this.defaultValue = value;
    return this;
  }

  withZodSchema(zodSchema: z.ZodSchema<any>) {
    if (this.description !== undefined) {
      throw new Error("Cannot set Zod schema when description is set");
    }
    if (this.defaultValue !== undefined) {
      throw new Error("Cannot set Zod schema when default value is set");
    }
    this.customZodSchema = zodSchema;
    return this;
  }

  toZod(): ZodSchema<any> {
    if (this.customZodSchema) {
      return this.customZodSchema;
    }
    let zodSchema = this._toZod();
    if (this.description !== undefined) {
      zodSchema = zodSchema.describe(this.description);
    }
    if (this.defaultValue !== undefined) {
      zodSchema = zodSchema.default(this.defaultValue);
    }
    return zodSchema;
  }

  protected abstract _toZod(): ZodSchema<any>;
}

export class StringSchema extends BaseSchema<StreamingString> {
  override create(): StreamingString {
    return new StreamingString();
  }

  override _toZod() {
    return z.string();
  }
}

export function string(): StringSchema {
  return new StringSchema();
}

export class ArraySchema<T extends StreamingValue<any>> extends BaseSchema<StreamingList<T>> {
  constructor(private itemSchema: BaseSchema<T>) {
    super();
  }

  override create(): StreamingList<T> {
    return new StreamingList(this.itemSchema);
  }

  override _toZod() {
    return z.array(this.itemSchema.toZod());
  }
}

export class AtomArraySchema<T> extends BaseSchema<StreamingAtomList<T>> {
  constructor(public readonly zodSchema: ZodSchema<T>) {
    super();
  }

  override create(): StreamingAtomList<T> {
    return new StreamingAtomList<T>(this.zodSchema);
  }

  override _toZod() {
    return z.array(this.zodSchema);
  }
}

export function array<T>(zodSchema: z.ZodType<T>): AtomArraySchema<T>;
export function array<T>(itemSchema: AtomSchema<T>): AtomArraySchema<T>;
export function array<T extends StreamingValue<any>>(itemSchema: BaseSchema<T>): ArraySchema<T>;
export function array(itemSchema: any): any {
  if (itemSchema instanceof z.ZodType) {
    return new AtomArraySchema(itemSchema);
  }
  if (itemSchema instanceof AtomSchema) {
    return new AtomArraySchema(itemSchema.zodSchema);
  }
  return new ArraySchema(itemSchema);
}

export class AtomSchema<T> extends BaseSchema<Atom<T>> {
  constructor(public readonly zodSchema: ZodSchema<T>) {
    super();
  }

  override create(): Atom<T> {
    return new Atom<T>(this.zodSchema);
  }

  override _toZod() {
    return this.zodSchema;
  }
}

export function atom<T>(zodSchema: ZodSchema<T>): AtomSchema<T> {
  return new AtomSchema<T>(zodSchema);
}

/**
 * Create a Atom for numbers - alias of atom(z.number())
 */
export function number(): AtomSchema<number> {
  return atom(z.number());
}

/**
 * Create a Atom for booleans - alias of atom(z.boolean())
 */
export function boolean(): AtomSchema<boolean> {
  return atom(z.boolean());
}

type ObjectSchemaFields<T> = {
  [K in keyof T]: T[K] extends BaseSchema<infer U> ? U : never
};
export type ObjectSchemaInstance<T> = StreamingObject<ObjectSchemaFields<T>> & ObjectSchemaFields<T>;

export class ObjectSchema<T extends Record<string, BaseSchema<any>>> extends BaseSchema<ObjectSchemaInstance<T>> {
  constructor(private fields: T) {
    super();
  }

  override create(): ObjectSchemaInstance<T> {
    const fields = Object.fromEntries(
      Object.entries(this.fields).map(([key, field]) => [key, field.create()])
    ) as ObjectSchemaFields<T>;
    const instance = new StreamingObject(fields);
    // Bind fields as property for convenience
    Object.assign(instance, fields);
    return instance as ObjectSchemaInstance<T>;
  }

  override _toZod() {
    return z.object(
      Object.fromEntries(
        Object.entries(this.fields).map(([key, field]) => [key, field.toZod()])
      )
    );
  }
}

export function object<T extends Record<string, BaseSchema<any>>>(fields: T): ObjectSchema<T> {
  return new ObjectSchema<T>(fields);
}
