// src/lib/falcon/codeStructureParser.ts
// Falcon AI — Real-time Code Structure Parser
// Reads and interprets the ERP codebase structure dynamically

import { GENERATED_PAGE_INDEX, type GeneratedPageEntry } from "./generatedPageIndex";
import { ERP_MODULES, ERP_ACCOUNTING_RULES, ERP_FORMULAS, type ERPModuleDoc } from "./erpCodeKnowledge";
import { FALCON_KB, type FalconKBEntry } from "./knowledgeBase";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CodeStructureInfo {
  route: string;
  title: string;
  subtitle: string;
  component: string;
  filePath: string;
  menuPath: string;
  aliases: string[];
  category: "transaction" | "master" | "report" | "config" | "dashboard" | "unknown";
  relatedRoutes: string[];
  moduleDoc?: ERPModuleDoc;
  kbEntries: FalconKBEntry[];
  accountingRules: typeof ERP_ACCOUNTING_RULES;
  formulas: typeof ERP_FORMULAS;
}

export interface ModuleSearchResult {
  entry: GeneratedPageEntry;
  score: number;
  matchType: "exact" | "alias" | "title" | "partial";
  moduleDoc?: ERPModuleDoc;
}

export interface CodeKnowledge {
  pages: GeneratedPageEntry[];
  modules: Record<string, ERPModuleDoc>;
  kbEntries: FalconKBEntry[];
  routeToModule: Map<string, string>;
  aliasToRoute: Map<string, string>;
  keywordIndex: Map<string, string[]>;
  lastUpdated: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE BASE INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

let codeKnowledge: CodeKnowledge | null = null;

function initializeCodeKnowledge(): CodeKnowledge {
  if (codeKnowledge) return codeKnowledge;

  const routeToModule = new Map<string, string>();
  const aliasToRoute = new Map<string, string>();
  const keywordIndex = new Map<string, string[]>();

  // Build route-to-module mapping
  for (const [moduleId, moduleDoc] of Object.entries(ERP_MODULES)) {
    routeToModule.set(moduleDoc.route, moduleId);
    routeToModule.set(moduleId, moduleId);
  }

  // Build alias-to-route mapping from page index
  for (const page of GENERATED_PAGE_INDEX) {
    for (const alias of page.aliases) {
      aliasToRoute.set(alias.toLowerCase(), page.route);
    }
    aliasToRoute.set(page.route.toLowerCase(), page.route);
    aliasToRoute.set(page.component.toLowerCase(), page.route);
  }

  // Build keyword index for fast searching
  const addToKeywordIndex = (keyword: string, route: string) => {
    const lower = keyword.toLowerCase();
    if (!keywordIndex.has(lower)) {
      keywordIndex.set(lower, []);
    }
    const routes = keywordIndex.get(lower)!;
    if (!routes.includes(route)) {
      routes.push(route);
    }
  };

  for (const page of GENERATED_PAGE_INDEX) {
    // Index by title words
    page.title.split(/\s+/).forEach((word) => {
      if (word.length > 2) addToKeywordIndex(word, page.route);
    });
    
    // Index by subtitle words
    page.subtitle.split(/\s+/).forEach((word) => {
      if (word.length > 2) addToKeywordIndex(word, page.route);
    });
    
    // Index by menu path words
    page.menuPath.split(/[\s→]+/).forEach((word) => {
      if (word.length > 2) addToKeywordIndex(word, page.route);
    });
    
    // Index by route segments
    page.route.split("-").forEach((segment) => {
      if (segment.length > 2) addToKeywordIndex(segment, page.route);
    });
    
    // Index by aliases
    page.aliases.forEach((alias) => {
      addToKeywordIndex(alias, page.route);
      alias.split("-").forEach((segment) => {
        if (segment.length > 2) addToKeywordIndex(segment, page.route);
      });
    });
  }

  // Index KB entries
  for (const entry of FALCON_KB) {
    const route = entry.module;
    entry.keywords.forEach((keyword) => {
      addToKeywordIndex(keyword, route);
    });
    entry.title.split(/\s+/).forEach((word) => {
      if (word.length > 2) addToKeywordIndex(word, route);
    });
  }

  codeKnowledge = {
    pages: GENERATED_PAGE_INDEX,
    modules: ERP_MODULES,
    kbEntries: FALCON_KB,
    routeToModule,
    aliasToRoute,
    keywordIndex,
    lastUpdated: new Date().toISOString(),
  };

  return codeKnowledge;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

export function resolveRoute(input: string): string | null {
  const knowledge = initializeCodeKnowledge();
  const normalized = input.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");

  // Direct match
  if (knowledge.aliasToRoute.has(normalized)) {
    return knowledge.aliasToRoute.get(normalized)!;
  }

  // Check page routes
  const page = GENERATED_PAGE_INDEX.find(
    (p) =>
      p.route === normalized ||
      p.aliases.includes(normalized) ||
      p.component.toLowerCase() === normalized
  );
  if (page) return page.route;

  // Fuzzy match by keyword
  const routesFromKeywords = knowledge.keywordIndex.get(normalized);
  if (routesFromKeywords && routesFromKeywords.length > 0) {
    return routesFromKeywords[0];
  }

  // Try partial matching
  for (const [alias, route] of knowledge.aliasToRoute) {
    if (alias.includes(normalized) || normalized.includes(alias)) {
      return route;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export function searchModules(query: string, limit: number = 5): ModuleSearchResult[] {
  const knowledge = initializeCodeKnowledge();
  const normalized = query.toLowerCase().replace(/[^\w\s-]/g, " ").trim();
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 1);
  
  const results: ModuleSearchResult[] = [];

  for (const page of GENERATED_PAGE_INDEX) {
    let score = 0;
    let matchType: "exact" | "alias" | "title" | "partial" = "partial";

    // Exact route match
    if (page.route === normalized || page.route.replace(/-/g, " ") === normalized) {
      score = 100;
      matchType = "exact";
    }
    // Alias match
    else if (page.aliases.some((a) => a === normalized || a.replace(/-/g, " ") === normalized)) {
      score = 95;
      matchType = "alias";
    }
    // Title match
    else if (page.title.toLowerCase().includes(normalized)) {
      score = 85;
      matchType = "title";
    }
    // Token matching
    else {
      const searchableText = [
        page.route,
        ...page.aliases,
        page.title,
        page.subtitle,
        page.menuPath,
        page.component,
      ].join(" ").toLowerCase();

      for (const token of tokens) {
        if (searchableText.includes(token)) {
          score += 10;
        }
      }
      
      if (score > 0) {
        matchType = "partial";
      }
    }

    if (score > 0) {
      const moduleId = knowledge.routeToModule.get(page.route) || 
                       knowledge.routeToModule.get(page.route.split("-")[0]);
      
      results.push({
        entry: page,
        score,
        matchType,
        moduleDoc: moduleId ? ERP_MODULES[moduleId] : undefined,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// CODE STRUCTURE INFO
// ─────────────────────────────────────────────────────────────────────────────

export function getCodeStructureInfo(routeOrQuery: string): CodeStructureInfo | null {
  const knowledge = initializeCodeKnowledge();
  
  // Try to resolve to a route
  const route = resolveRoute(routeOrQuery) || routeOrQuery;
  
  // Find the page entry
  const page = GENERATED_PAGE_INDEX.find(
    (p) => p.route === route || p.aliases.includes(route)
  );
  
  if (!page) {
    return null;
  }

  // Find module documentation
  const moduleId = knowledge.routeToModule.get(route) ||
                   knowledge.routeToModule.get(route.split("-")[0]);
  const moduleDoc = moduleId ? ERP_MODULES[moduleId] : undefined;

  // Determine category
  let category: CodeStructureInfo["category"] = "unknown";
  if (moduleDoc) {
    category = moduleDoc.category;
  } else if (page.menuPath.includes("Reports") || page.route.includes("report")) {
    category = "report";
  } else if (page.menuPath.includes("Masters") || page.route.includes("master")) {
    category = "master";
  } else if (page.menuPath.includes("Transactions") || page.route.includes("voucher")) {
    category = "transaction";
  } else if (page.menuPath.includes("Administration") || page.route.includes("config")) {
    category = "config";
  } else if (page.route.includes("dashboard")) {
    category = "dashboard";
  }

  // Find related routes
  const relatedRoutes: string[] = [];
  if (moduleDoc?.relatedModules) {
    for (const related of moduleDoc.relatedModules) {
      const relatedRoute = resolveRoute(related);
      if (relatedRoute && relatedRoute !== route) {
        relatedRoutes.push(relatedRoute);
      }
    }
  }

  // Find relevant KB entries
  const kbEntries = FALCON_KB.filter((entry) => {
    const entryText = [entry.module, entry.title, ...entry.keywords].join(" ").toLowerCase();
    const routeText = [route, page.title, ...page.aliases].join(" ").toLowerCase();
    return entryText.includes(route) || routeText.includes(entry.module);
  });

  // Find relevant accounting rules
  const accountingRules = moduleDoc ? 
    ERP_ACCOUNTING_RULES.filter((rule) => {
      const ruleOp = rule.operation.toLowerCase();
      return page.route.includes(ruleOp.split("-")[0]) ||
             ruleOp.includes(page.route.split("-")[0]);
    }) : [];

  // Find relevant formulas
  const formulas = ERP_FORMULAS.filter((formula) => {
    const formulaTopic = formula.topic.toLowerCase();
    const routeLower = route.toLowerCase();
    return formulaTopic.includes(routeLower) || routeLower.includes(formula.id);
  });

  return {
    route: page.route,
    title: page.title,
    subtitle: page.subtitle.replace(/&amp;/g, "&"),
    component: page.component,
    filePath: page.file,
    menuPath: page.menuPath,
    aliases: page.aliases,
    category,
    relatedRoutes,
    moduleDoc,
    kbEntries,
    accountingRules,
    formulas,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIND RELEVANT KNOWLEDGE
// ─────────────────────────────────────────────────────────────────────────────

export function findRelevantKnowledge(
  query: string,
  currentRoute?: string
): {
  pages: ModuleSearchResult[];
  kbEntries: FalconKBEntry[];
  moduleDoc: ERPModuleDoc | undefined;
  accountingRules: typeof ERP_ACCOUNTING_RULES;
  formulas: typeof ERP_FORMULAS;
} {
  const knowledge = initializeCodeKnowledge();
  
  // Search for relevant pages
  const pages = searchModules(query, 3);
  
  // Get current route info if available
  let moduleDoc: ERPModuleDoc | undefined;
  if (currentRoute) {
    const moduleId = knowledge.routeToModule.get(currentRoute) ||
                     knowledge.routeToModule.get(currentRoute.split("-")[0]);
    moduleDoc = moduleId ? ERP_MODULES[moduleId] : undefined;
  }
  
  // If no module doc from route, try from search results
  if (!moduleDoc && pages.length > 0 && pages[0].moduleDoc) {
    moduleDoc = pages[0].moduleDoc;
  }
  
  // Search KB entries
  const queryLower = query.toLowerCase();
  const queryTokens = queryLower.split(/\s+/).filter((t) => t.length > 2);
  
  const kbEntries = FALCON_KB.filter((entry) => {
    const entryText = [
      entry.title,
      entry.module,
      ...entry.keywords,
      entry.answer.substring(0, 200),
    ].join(" ").toLowerCase();
    
    // Check for token matches
    let matchCount = 0;
    for (const token of queryTokens) {
      if (entryText.includes(token)) {
        matchCount++;
      }
    }
    
    return matchCount >= Math.min(2, queryTokens.length);
  }).slice(0, 5);
  
  // Find relevant accounting rules
  const accountingRules = ERP_ACCOUNTING_RULES.filter((rule) => {
    const ruleText = [rule.operation, rule.debit, rule.credit, rule.notes]
      .join(" ").toLowerCase();
    return queryTokens.some((token) => ruleText.includes(token));
  }).slice(0, 3);
  
  // Find relevant formulas
  const formulas = ERP_FORMULAS.filter((formula) => {
    const formulaText = [formula.topic, formula.formula, formula.context]
      .join(" ").toLowerCase();
    return queryTokens.some((token) => formulaText.includes(token));
  }).slice(0, 2);
  
  return {
    pages,
    kbEntries,
    moduleDoc,
    accountingRules,
    formulas,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION PATH BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export function getNavigationPath(routeOrQuery: string): string | null {
  const info = getCodeStructureInfo(routeOrQuery);
  
  if (!info) {
    // Try to find from search
    const results = searchModules(routeOrQuery, 1);
    if (results.length > 0) {
      return results[0].entry.menuPath || `Navigate to: ${results[0].entry.route}`;
    }
    return null;
  }
  
  if (info.menuPath) {
    return info.menuPath;
  }
  
  if (info.moduleDoc?.howToAccess?.length) {
    return info.moduleDoc.howToAccess[0];
  }
  
  return `Route: ${info.route}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHORTCUT FINDER
// ─────────────────────────────────────────────────────────────────────────────

export function getKeyboardShortcuts(routeOrQuery: string): Record<string, string> | null {
  const info = getCodeStructureInfo(routeOrQuery);
  
  if (info?.moduleDoc?.keyboardShortcuts) {
    return info.moduleDoc.keyboardShortcuts;
  }
  
  // Return common shortcuts if no specific ones found
  return {
    "F2": "Save/Post",
    "F3": "Add new item",
    "F8": "Delete selected",
    "Esc": "Cancel/Close",
    "Ctrl+P": "Print",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION RULES FINDER
// ─────────────────────────────────────────────────────────────────────────────

export function getValidationRules(routeOrQuery: string): string[] {
  const info = getCodeStructureInfo(routeOrQuery);
  
  if (info?.moduleDoc?.validationRules) {
    return info.moduleDoc.validationRules;
  }
  
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMON ERRORS FINDER
// ─────────────────────────────────────────────────────────────────────────────

export function getCommonErrors(routeOrQuery: string): Array<{ error: string; solution: string }> {
  const info = getCodeStructureInfo(routeOrQuery);
  
  if (info?.moduleDoc?.commonErrors) {
    return info.moduleDoc.commonErrors;
  }
  
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW STEPS FINDER
// ─────────────────────────────────────────────────────────────────────────────

export function getWorkflowSteps(routeOrQuery: string): string[] {
  const info = getCodeStructureInfo(routeOrQuery);
  
  if (info?.moduleDoc?.workflow?.steps) {
    return info.moduleDoc.workflow.steps;
  }
  
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTING IMPACT FINDER
// ─────────────────────────────────────────────────────────────────────────────

export function getAccountingImpact(routeOrQuery: string): string | null {
  const info = getCodeStructureInfo(routeOrQuery);
  
  if (info?.moduleDoc?.accountingImpact) {
    return info?.moduleDoc.accountingImpact;
  }
  
  // Check accounting rules
  if (info?.accountingRules?.length) {
    const rule = info.accountingRules[0];
    return `${rule.debit} (Dr) → ${rule.credit} (Cr)`;
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS
// ─────────────────────────────────────────────────────────────────────────────

export function getCodebaseStats(): {
  totalScreens: number;
  totalModuleDocs: number;
  totalKBEntries: number;
  totalAccountingRules: number;
  totalFormulas: number;
  categories: Record<string, number>;
} {
  const categories: Record<string, number> = {};
  
  for (const [, module] of Object.entries(ERP_MODULES)) {
    categories[module.category] = (categories[module.category] || 0) + 1;
  }
  
  return {
    totalScreens: GENERATED_PAGE_INDEX.length,
    totalModuleDocs: Object.keys(ERP_MODULES).length,
    totalKBEntries: FALCON_KB.length,
    totalAccountingRules: ERP_ACCOUNTING_RULES.length,
    totalFormulas: ERP_FORMULAS.length,
    categories,
  };
}
