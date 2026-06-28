const fs = require('fs');
let content = fs.readFileSync('src/store/index.ts', 'utf-8').replace(/\r\n/g, '\n');

// 1. Update AppState Interface
const target1 = '  updatePaymentAdvice: (id: string, data: Partial<any>) => Promise<void>;\n}';
const replacement1 = `  updatePaymentAdvice: (id: string, data: Partial<any>) => Promise<void>;

  // NEW FEATURE TABLES FROM VERSION 13
  branches: any[];
  salespersons: any[];
  exchangeRates: any[];
  followUpNotes: any[];
  jobWorkOrders: any[];
  reportSchedules: any[];
  priceFloorPolicies: any[];
  chequeBounceLogs: any[];

  addBranch: (data: Partial<any>) => Promise<any>;
  updateBranch: (id: string, data: Partial<any>) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;
  addSalesperson: (data: Partial<any>) => Promise<any>;
  updateSalesperson: (id: string, data: Partial<any>) => Promise<void>;
  deleteSalesperson: (id: string) => Promise<void>;
  addExchangeRate: (data: Partial<any>) => Promise<any>;
  updateExchangeRate: (id: string, data: Partial<any>) => Promise<void>;
  deleteExchangeRate: (id: string) => Promise<void>;
}`;
if (content.includes(target1)) content = content.replace(target1, replacement1);
else console.log('Target 1 not found');

// 2. Update initial store properties (before stockJournals: [])
const target2 = '  paymentAdvices: [],\n\n  stockJournals: [],';
const replacement2 = `  paymentAdvices: [],

  branches: [],
  salespersons: [],
  exchangeRates: [],
  followUpNotes: [],
  jobWorkOrders: [],
  reportSchedules: [],
  priceFloorPolicies: [],
  chequeBounceLogs: [],

  stockJournals: [],`;
if (content.includes(target2)) content = content.replace(target2, replacement2);
else console.log('Target 2 not found');

// 3. Promise.all destructuring array
const target3 = '      chequeBooks, cheques, depositSlips, pdCheques, ePaymentBatches, paymentAdvices,\n    ] = await Promise.all([';
const replacement3 = `      chequeBooks, cheques, depositSlips, pdCheques, ePaymentBatches, paymentAdvices,
      // Version 13
      branches, salespersons, exchangeRates, followUpNotes, jobWorkOrders, reportSchedules, priceFloorPolicies, chequeBounceLogs,
    ] = await Promise.all([`;
if (content.includes(target3)) content = content.replace(target3, replacement3);
else console.log('Target 3 not found');

// 4. Promise.all array calls
const target4 = '      db.paymentAdvices.toArray(),\n    ]);\n\n    const currentFiscalYear';
const replacement4 = `      db.paymentAdvices.toArray(),
      db.branches.toArray().catch(() => []),
      db.salespersons.toArray().catch(() => []),
      db.exchangeRates.toArray().catch(() => []),
      db.followUpNotes.toArray().catch(() => []),
      db.jobWorkOrders.toArray().catch(() => []),
      db.reportSchedules.toArray().catch(() => []),
      db.priceFloorPolicies.toArray().catch(() => []),
      db.chequeBounceLogs.toArray().catch(() => []),
    ]);

    const currentFiscalYear`;
if (content.includes(target4)) content = content.replace(target4, replacement4);
else console.log('Target 4 not found');

// 5. set state in initializeApp
const target5 = '      paymentAdvices: paymentAdvices as any[],\n      \n      journalEntries: vouchers,';
const replacement5 = `      paymentAdvices: paymentAdvices as any[],
      branches: branches as any[],
      salespersons: salespersons as any[],
      exchangeRates: exchangeRates as any[],
      followUpNotes: followUpNotes as any[],
      jobWorkOrders: jobWorkOrders as any[],
      reportSchedules: reportSchedules as any[],
      priceFloorPolicies: priceFloorPolicies as any[],
      chequeBounceLogs: chequeBounceLogs as any[],
      
      journalEntries: vouchers,`;
if (content.includes(target5)) content = content.replace(target5, replacement5);
else console.log('Target 5 not found');

// 6. Add the actions before getBaseCurrency closes
const target6 = '  getBaseCurrency: () => {\n    const { currencies } = get();\n    return currencies.find((c) => c.isBase) || currencies[0] || DEFAULT_CURRENCY;\n  },\n}));\n\n// ─── Private helpers';
const replacement6 = `  getBaseCurrency: () => {
    const { currencies } = get();
    return currencies.find((c) => c.isBase) || currencies[0] || DEFAULT_CURRENCY;
  },

  // NEW ACTIONS FOR VERSION 13
  addBranch: async (branch: any) => {
    const db = getDB();
    const newBranch = { id: generateId(), ...branch, createdAt: new Date().toISOString() };
    await db.branches.put(newBranch);
    set((s: any) => ({ branches: [...s.branches, newBranch] }));
    return newBranch;
  },
  updateBranch: async (id: string, data: any) => {
    const db = getDB();
    await db.branches.update(id, data);
    set((s: any) => ({ branches: s.branches.map((b: any) => b.id === id ? { ...b, ...data } : b) }));
  },
  deleteBranch: async (id: string) => {
    const db = getDB();
    await db.branches.delete(id);
    set((s: any) => ({ branches: s.branches.filter((b: any) => b.id !== id) }));
  },

  addSalesperson: async (sp: any) => {
    const db = getDB();
    const newSp = { id: generateId(), ...sp, createdAt: new Date().toISOString() };
    await db.salespersons.put(newSp);
    set((s: any) => ({ salespersons: [...s.salespersons, newSp] }));
    return newSp;
  },
  updateSalesperson: async (id: string, data: any) => {
    const db = getDB();
    await db.salespersons.update(id, data);
    set((s: any) => ({ salespersons: s.salespersons.map((x: any) => x.id === id ? { ...x, ...data } : x) }));
  },
  deleteSalesperson: async (id: string) => {
    const db = getDB();
    await db.salespersons.delete(id);
    set((s: any) => ({ salespersons: s.salespersons.filter((x: any) => x.id !== id) }));
  },

  addExchangeRate: async (rate: any) => {
    const db = getDB();
    const newRate = { id: generateId(), ...rate, createdAt: new Date().toISOString() };
    await db.exchangeRates.put(newRate);
    set((s: any) => ({ exchangeRates: [...s.exchangeRates, newRate] }));
    return newRate;
  },
  updateExchangeRate: async (id: string, data: any) => {
    const db = getDB();
    await db.exchangeRates.update(id, data);
    set((s: any) => ({ exchangeRates: s.exchangeRates.map((x: any) => x.id === id ? { ...x, ...data } : x) }));
  },
  deleteExchangeRate: async (id: string) => {
    const db = getDB();
    await db.exchangeRates.delete(id);
    set((s: any) => ({ exchangeRates: s.exchangeRates.filter((x: any) => x.id !== id) }));
  },
}));

// ─── Private helpers`;
if (content.includes(target6)) content = content.replace(target6, replacement6);
else console.log('Target 6 not found');

fs.writeFileSync('src/store/index.ts', content);
console.log('done');
