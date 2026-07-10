const counters: Record<string, number> = {
  contextRefreshes: 0,
  permissionChecks: 0,
  authzDenials: 0,
  jwtValidations: 0,
  jwtFailures: 0,
};

export const identityMetrics = {
  incrementContextRefreshes(): void {
    counters.contextRefreshes += 1;
  },
  incrementPermissionChecks(): void {
    counters.permissionChecks += 1;
  },
  incrementAuthzDenials(): void {
    counters.authzDenials += 1;
  },
  incrementJwtValidations(): void {
    counters.jwtValidations += 1;
  },
  incrementJwtFailures(): void {
    counters.jwtFailures += 1;
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
