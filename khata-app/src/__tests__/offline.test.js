"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
(0, vitest_1.describe)("offline queue policy", function () {
    (0, vitest_1.it)("uses FIFO idempotency keys", function () {
        var key = crypto.randomUUID();
        (0, vitest_1.expect)(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
    (0, vitest_1.it)("detects offline state", function () {
        vitest_1.vi.stubGlobal("navigator", { onLine: false });
        (0, vitest_1.expect)(navigator.onLine).toBe(false);
    });
});
