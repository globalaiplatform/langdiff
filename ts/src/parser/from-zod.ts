import { z } from "zod";
import { array, ArraySchema, atom, AtomArraySchema, AtomSchema, BaseSchema, ObjectSchema, ObjectSchemaInstance, string, StringSchema } from "./schema";
import { StreamingString } from "./model";

/**
 * Helper function to create streaming fields from Zod types
 */
export function fromZod<T extends z.ZodType>(zodType: T): ZodTypeToStreamingType<T> {
  const fromZodInternal = () => {
    // Handle optional and nullable wrappers first
    let unwrapped = zodType;
    while (unwrapped instanceof z.ZodOptional || unwrapped instanceof z.ZodNullable) {
      unwrapped = unwrapped.unwrap();
    }

    if (unwrapped instanceof z.ZodString) {
      return string();
    }

    if (unwrapped instanceof z.ZodArray) {
      if (unwrapped.element instanceof z.ZodString) {
        return array(string());
      }
      if (unwrapped.element instanceof z.ZodObject) {
        return array(fromZodObject(unwrapped.element));
      }
      return array(unwrapped.element);
    }

    if (unwrapped instanceof z.ZodObject) {
      return fromZodObject(unwrapped);
    }

    return atom(zodType);
  };
  return fromZodInternal().withZodSchema(zodType) as ZodTypeToStreamingType<T>;
}

function fromZodObject<T extends z.ZodRawShape>(
  zodSchema: z.ZodObject<T>
): ObjectSchema<ZodToStreamingFields<T>> {
  const shape = zodSchema.shape;

  const fields: {[key: string]: BaseSchema<any>} = {};
  for (const [key, zodType] of Object.entries(shape)) {
    fields[key] = fromZod(zodType);
  }

  return new ObjectSchema(fields) as any;
}

/**
 * Type mapping from Zod types to Streaming types
 */
type ZodToStreamingFields<T extends z.ZodRawShape> = {
  [K in keyof T]: ZodTypeToStreamingType<T[K]>
}

type ZodTypeToStreamingType<T> = 
  T extends z.ZodString ? StringSchema :
  T extends z.ZodNumber ? AtomSchema<number> :
  T extends z.ZodBoolean ? AtomSchema<boolean> :
  T extends z.ZodArray<infer U> ?
    U extends z.ZodString ? ArraySchema<StreamingString> :
    U extends z.ZodObject<infer V> ? ArraySchema<ObjectSchemaInstance<ZodToStreamingFields<V>>> :
      AtomArraySchema<ZodTypeToStreamingType<U>> :
  T extends z.ZodObject<infer U> ? ObjectSchema<ZodToStreamingFields<U>> :
  T extends z.ZodOptional<infer U> ? ZodTypeToStreamingType<U> :
  T extends z.ZodNullable<infer U> ? ZodTypeToStreamingType<U> :
  T extends z.ZodType<infer U, any> ? AtomSchema<U> :
  never;
