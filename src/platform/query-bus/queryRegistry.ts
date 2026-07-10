import type { IQueryHandler } from "@fios/kernel";

export class QueryHandlerRegistry {
  private readonly handlers = new Map<string, IQueryHandler>();

  register(handler: IQueryHandler): void {
    if (this.handlers.has(handler.queryType)) {
      throw new Error(`Query handler already registered: ${handler.queryType}`);
    }
    this.handlers.set(handler.queryType, handler);
  }

  get(queryType: string): IQueryHandler | undefined {
    return this.handlers.get(queryType);
  }

  has(queryType: string): boolean {
    return this.handlers.has(queryType);
  }

  registeredQueryTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  clear(): void {
    this.handlers.clear();
  }
}
