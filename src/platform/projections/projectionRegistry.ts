import type { IDomainEvent } from "@fios/kernel";

export interface ProjectionContext {
  globalSequence: number;
  dryRun: boolean;
  tenantId: string;
}

export interface IProjectionHandler {
  readonly projectionName: string;
  readonly supportedEventTypes: readonly string[];
  apply(event: IDomainEvent, context: ProjectionContext): Promise<void>;
  clear?(): Promise<void>;
}

export class ProjectionRegistry {
  private readonly handlers = new Map<string, IProjectionHandler>();

  register(handler: IProjectionHandler): void {
    if (this.handlers.has(handler.projectionName)) {
      throw new Error(`Projection handler already registered: ${handler.projectionName}`);
    }
    this.handlers.set(handler.projectionName, handler);
  }

  get(name: string): IProjectionHandler | undefined {
    return this.handlers.get(name);
  }

  all(): IProjectionHandler[] {
    return Array.from(this.handlers.values());
  }

  forEvent(eventType: string): IProjectionHandler[] {
    return this.all().filter(
      (handler) =>
        handler.supportedEventTypes.includes("*") ||
        handler.supportedEventTypes.includes(eventType),
    );
  }

  clear(): void {
    this.handlers.clear();
  }
}
