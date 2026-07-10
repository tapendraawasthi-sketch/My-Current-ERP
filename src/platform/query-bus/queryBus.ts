import type { IQuery, IQueryBus, IQueryHandler, IQueryResult, JsonObject } from "@fios/kernel";
import { FiosErrorCode } from "@fios/kernel";
import { logQuery } from "./queryLogger";
import { queryMetrics } from "./queryMetrics";
import { recordQueryDiagnostic } from "./queryDiagnostics";
import { validateQuery } from "./queryValidator";
import { QueryHandlerRegistry } from "./queryRegistry";

export class SyncQueryBus implements IQueryBus {
  private readonly registry = new QueryHandlerRegistry();

  registerHandler(handler: IQueryHandler): void {
    this.registry.register(handler);
  }

  async dispatch<TPayload extends JsonObject>(
    query: IQuery<TPayload>,
  ): Promise<IQueryResult> {
    const started = performance.now();
    queryMetrics.incrementDispatched();
    recordQueryDiagnostic({
      queryId: query.queryId,
      queryType: query.queryType,
      correlationId: query.correlationId,
      stage: "dispatched",
      timestamp: new Date().toISOString(),
    });

    const validation = validateQuery(query);
    if (!validation.valid) {
      const message = validation.errors.join("; ");
      logQuery("warn", "validation-failed", query, { errors: validation.errors });
      recordQueryDiagnostic({
        queryId: query.queryId,
        queryType: query.queryType,
        correlationId: query.correlationId,
        stage: "validation_failed",
        error: message,
        durationMs: performance.now() - started,
        timestamp: new Date().toISOString(),
      });
      return {
        status: "rejected",
        errors: [{ code: FiosErrorCode.VALIDATION_FAILED, message }],
        correlationId: query.correlationId,
      };
    }

    const handler = this.registry.get(query.queryType);
    if (!handler) {
      const message = `No handler registered for query type: ${query.queryType}`;
      logQuery("error", "handler-missing", query);
      recordQueryDiagnostic({
        queryId: query.queryId,
        queryType: query.queryType,
        correlationId: query.correlationId,
        stage: "rejected",
        error: message,
        durationMs: performance.now() - started,
        timestamp: new Date().toISOString(),
      });
      return {
        status: "rejected",
        errors: [{ code: FiosErrorCode.NOT_FOUND, message }],
        correlationId: query.correlationId,
      };
    }

    const result = await handler.handle(query);
    const durationMs = performance.now() - started;

    if (result.status === "ok") {
      queryMetrics.incrementOk();
    } else if (result.status === "not_found") {
      queryMetrics.incrementNotFound();
    } else {
      queryMetrics.incrementRejected();
    }

    recordQueryDiagnostic({
      queryId: query.queryId,
      queryType: query.queryType,
      correlationId: query.correlationId,
      stage: result.status === "ok" ? "ok" : result.status,
      durationMs,
      error: result.errors?.map((e) => e.message).join("; "),
      timestamp: new Date().toISOString(),
    });

    logQuery("debug", "dispatch-complete", query, { status: result.status, durationMs });
    return { ...result, correlationId: query.correlationId };
  }

  hasHandler(queryType: string): boolean {
    return this.registry.has(queryType);
  }

  registeredQueryTypes(): string[] {
    return this.registry.registeredQueryTypes();
  }

  dispatchSync<TPayload extends JsonObject>(query: IQuery<TPayload>): IQueryResult {
    const started = performance.now();
    queryMetrics.incrementDispatched();
    recordQueryDiagnostic({
      queryId: query.queryId,
      queryType: query.queryType,
      correlationId: query.correlationId,
      stage: "dispatched",
      timestamp: new Date().toISOString(),
    });

    const validation = validateQuery(query);
    if (!validation.valid) {
      const message = validation.errors.join("; ");
      logQuery("warn", "validation-failed", query, { errors: validation.errors });
      return {
        status: "rejected",
        errors: [{ code: FiosErrorCode.VALIDATION_FAILED, message }],
        correlationId: query.correlationId,
      };
    }

    const handler = this.registry.get(query.queryType) as
      | (IQueryHandler & { handleSync?(query: IQuery): IQueryResult })
      | undefined;
    if (!handler) {
      const message = `No handler registered for query type: ${query.queryType}`;
      return {
        status: "rejected",
        errors: [{ code: FiosErrorCode.NOT_FOUND, message }],
        correlationId: query.correlationId,
      };
    }
    if (!handler.handleSync) {
      throw new Error(`Query ${query.queryType} is async — use executeQuery()`);
    }

    const result = handler.handleSync(query);

    const durationMs = performance.now() - started;
    if (result.status === "ok") queryMetrics.incrementOk();
    else if (result.status === "not_found") queryMetrics.incrementNotFound();
    else queryMetrics.incrementRejected();

    recordQueryDiagnostic({
      queryId: query.queryId,
      queryType: query.queryType,
      correlationId: query.correlationId,
      stage: result.status === "ok" ? "ok" : result.status,
      durationMs,
      error: result.errors?.map((e) => e.message).join("; "),
      timestamp: new Date().toISOString(),
    });

    return { ...result, correlationId: query.correlationId };
  }
}
