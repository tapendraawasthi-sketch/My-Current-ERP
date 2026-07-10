import type { IQuery, JsonObject } from "@fios/kernel";

export function createQueryEnvelope<TPayload extends JsonObject>(input: {
  queryType: string;
  payload: TPayload;
  queryId?: string;
  correlationId?: string;
  queryVersion?: number;
}): IQuery<TPayload> {
  return {
    queryId: input.queryId ?? crypto.randomUUID(),
    queryType: input.queryType,
    queryVersion: input.queryVersion ?? 1,
    payload: input.payload,
    correlationId: input.correlationId ?? crypto.randomUUID(),
    issuedAt: new Date().toISOString(),
  };
}
