const counters: Record<string, number> = {
  loaded: 0,
  activated: 0,
  unloaded: 0,
  commands: 0,
  queries: 0,
  blocked: 0,
  errors: 0,
};

export const pluginMetrics = {
  incrementLoaded(): void {
    counters.loaded += 1;
  },
  incrementActivated(): void {
    counters.activated += 1;
  },
  incrementUnloaded(): void {
    counters.unloaded += 1;
  },
  incrementCommands(): void {
    counters.commands += 1;
  },
  incrementQueries(): void {
    counters.queries += 1;
  },
  incrementBlocked(): void {
    counters.blocked += 1;
  },
  incrementErrors(): void {
    counters.errors += 1;
  },
  snapshot(): Record<string, number> {
    return { ...counters };
  },
  reset(): void {
    for (const key of Object.keys(counters)) {
      counters[key] = 0;
    }
  },
};
