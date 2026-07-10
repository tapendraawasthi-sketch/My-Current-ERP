import type { IQuery } from "@fios/kernel";
import { ALL_QUERY_TYPES } from "./queryTypes";

export interface QueryValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateQuery(query: IQuery): QueryValidationResult {
  const errors: string[] = [];

  if (!query.queryId) errors.push("queryId is required");
  if (!query.queryType) errors.push("queryType is required");
  if (!query.correlationId) errors.push("correlationId is required");
  if (!query.issuedAt) errors.push("issuedAt is required");
  if (query.queryVersion < 1) errors.push("queryVersion must be >= 1");

  if (query.queryType && !ALL_QUERY_TYPES.includes(query.queryType as never)) {
    errors.push(`Unknown query type: ${query.queryType}`);
  }

  if (query.payload === null || typeof query.payload !== "object" || Array.isArray(query.payload)) {
    errors.push("payload must be an object");
  }

  return { valid: errors.length === 0, errors };
}
