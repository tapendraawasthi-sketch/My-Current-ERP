// src/lib/falcon/precisionComposer.ts
// Falcon AI — Precision Response Composer
// Answers ONLY what is asked, nothing more, nothing less

import type { SmartIntent, ResponseStrategy, SectionType } from "./smartIntentEngine";
import { shouldIncludeSection, getResponseDirective } from "./smartIntentEngine";
import type { CodeStructureInfo } from "./codeStructureParser";
import {
  getCodeStructureInfo,
  getNavigationPathWithShortcut,
  getWorkflowSteps,
  getKeyboardShortcuts,
  getValidationRules,
  getCommonErrors,
  getAccountingImpact,
  findRelevantKnowledge,
  searchModules,
} from "./codeStructureParser";
import { ERP_MODULES, type ERPModuleDoc, type ERPFieldDoc } from "./erpCodeKnowledge";
import { formatNavAnswer, postComposeScope } from "./intentTaxonomy";
import { findKbEntryLastResort } from "./kbFallback";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ComposedResponse {
  answer: string;
  confidence: number;
  sources: string[];
  suggestions: string[];
  responseType: ResponseStrategy;
  sectionsIncluded: SectionType[];
  matchedModule?: string;
}

function scopeComposed(intent: SmartIntent, response: ComposedResponse): ComposedResponse {
  return {
    ...response,
    answer: postComposeScope(response.answer, intent.falconIntent),
  };
}

function composeFromKbLastResort(
  intent: SmartIntent,
  focus: string | null,
  responseType: ResponseStrategy,
  sectionsIncluded: SectionType[],
): ComposedResponse | null {
  const kbEntry = findKbEntryLastResort(intent.parsed.original, focus);
  if (!kbEntry) return null;

  return scopeComposed(intent, {
    answer: kbEntry.answer,
    confidence: 0.55,
    sources: [`kb:${kbEntry.id}`],
    suggestions: kbEntry.followups || [],
    responseType,
    sectionsIncluded,
    matchedModule: kbEntry.module,
  });
}

function resolveModuleInfo(focus: string) {
  const info = getCodeStructureInfo(focus);
  if (info?.moduleDoc) return info;

  const results = searchModules(focus, 1);
  if (results.length > 0) {
    const page = results[0].entry;
    const fromRoute = getCodeStructureInfo(page.route);
    if (fromRoute) return fromRoute;
  }
  return info;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION COMPOSERS
// ─────────────────────────────────────────────────────────────────────────────

function composeNavigationSection(info: CodeStructureInfo): string {
  const lines: string[] = [];
  
  if (info.menuPath) {
    lines.push(`**Location:** ${info.menuPath}`);
  } else if (info.moduleDoc?.howToAccess?.length) {
    lines.push(`**How to access:**`);
    info.moduleDoc.howToAccess.forEach((path) => {
      lines.push(`- ${path}`);
    });
  } else {
    lines.push(`**Route:** \`${info.route}\``);
  }
  
  return lines.join("\n");
}

function composeStepsSection(info: CodeStructureInfo): string {
  const steps = info.moduleDoc?.workflow?.steps || [];
  
  if (steps.length === 0) {
    return "";
  }
  
  const lines = ["**Steps:**"];
  steps.forEach((step, i) => {
    lines.push(`${i + 1}. ${step}`);
  });
  
  return lines.join("\n");
}

function composeFieldsSection(
  info: CodeStructureInfo,
  specificFields?: string[]
): string {
  const fields = info.moduleDoc?.keyFields || [];
  
  if (fields.length === 0) {
    return "";
  }
  
  let fieldsToShow: ERPFieldDoc[];
  
  if (specificFields && specificFields.length > 0) {
    fieldsToShow = fields.filter((f) =>
      specificFields.some(
        (sf) =>
          f.name.toLowerCase().includes(sf) ||
          f.fieldKey.toLowerCase().includes(sf) ||
          sf.includes(f.name.toLowerCase())
      )
    );
  } else {
    fieldsToShow = fields.filter((f) => f.required);
  }
  
  if (fieldsToShow.length === 0) {
    return "";
  }
  
  const lines = ["**Key Fields:**"];
  fieldsToShow.forEach((field) => {
    const required = field.required ? " *(required)*" : "";
    lines.push(`- **${field.name}**${required}: ${field.description}`);
  });
  
  return lines.join("\n");
}

function composeAccountingEffectSection(info: CodeStructureInfo): string {
  if (!info.moduleDoc?.accountingImpact) {
    return "";
  }
  
  return `**Accounting Effect:**\n${info.moduleDoc.accountingImpact}`;
}

function composeValidationSection(info: CodeStructureInfo): string {
  const rules = info.moduleDoc?.validationRules || [];
  
  if (rules.length === 0) {
    return "";
  }
  
  const lines = ["**Validation Rules:**"];
  rules.forEach((rule) => {
    lines.push(`- ${rule}`);
  });
  
  return lines.join("\n");
}

function composeCommonErrorsSection(info: CodeStructureInfo): string {
  const errors = info.moduleDoc?.commonErrors || [];
  
  if (errors.length === 0) {
    return "";
  }
  
  const lines = ["**Common Issues & Solutions:**"];
  errors.forEach((error) => {
    lines.push(`- **${error.error}** → ${error.solution}`);
  });
  
  return lines.join("\n");
}

function composeShortcutsSection(info: CodeStructureInfo): string {
  const shortcuts = info.moduleDoc?.keyboardShortcuts || {};
  const entries = Object.entries(shortcuts);
  
  if (entries.length === 0) {
    return "";
  }
  
  const lines = ["**Keyboard Shortcuts:**"];
  entries.forEach(([key, action]) => {
    lines.push(`- **${key}**: ${action}`);
  });
  
  return lines.join("\n");
}

function composeTipsSection(info: CodeStructureInfo): string {
  const tips: string[] = [];
  
  if (info.moduleDoc?.vatNote) {
    tips.push(`💡 **VAT:** ${info.moduleDoc.vatNote.substring(0, 150)}...`);
  }
  
  if (info.moduleDoc?.tdsNote) {
    tips.push(`💡 **TDS:** ${info.moduleDoc.tdsNote.substring(0, 150)}...`);
  }
  
  if (tips.length === 0) {
    return "";
  }
  
  return tips.join("\n\n");
}

function composePageOverviewSection(info: CodeStructureInfo): string {
  const lines: string[] = [];

  if (info.subtitle) {
    lines.push(info.subtitle);
  } else {
    lines.push(
      `The **${info.title}** screen (${info.category}) — part of the Sutra ERP navigation tree.`,
    );
  }

  if (info.menuPath) {
    lines.push(`**Menu path:** ${info.menuPath}`);
  }

  if (info.aliases.length > 0) {
    lines.push(`**Also known as:** ${info.aliases.join(", ")}`);
  }

  lines.push(`**Source file:** \`${info.filePath}\``);

  return lines.join("\n\n");
}

function composeRelatedSection(info: CodeStructureInfo): string {
  if (info.relatedRoutes.length === 0) {
    return "";
  }
  
  const related = info.relatedRoutes.slice(0, 3).map((r) => {
    const relatedInfo = getCodeStructureInfo(r);
    return relatedInfo ? relatedInfo.title : r;
  });
  
  return `**Related:** ${related.join(", ")}`;
}

function composeFollowUpsSection(info: CodeStructureInfo): string[] {
  const followUps: string[] = [];
  
  if (info.category === "transaction") {
    followUps.push(
      `How do I print ${info.title}?`,
      `What are the shortcuts for ${info.title}?`
    );
  } else if (info.category === "report") {
    followUps.push(
      `How do I export ${info.title}?`,
      `What filters are available?`
    );
  } else if (info.category === "master") {
    followUps.push(
      `How do I add a new entry?`,
      `What fields are required?`
    );
  }
  
  return followUps.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY-SPECIFIC COMPOSERS
// ─────────────────────────────────────────────────────────────────────────────

function composeNavigationOnlyResponse(intent: SmartIntent): ComposedResponse {
  const focus = intent.primaryFocus;

  if (!focus) {
    return scopeComposed(intent, {
      answer: "Please specify what you want to navigate to.",
      confidence: 0.3,
      sources: [],
      suggestions: ["Where is sales invoice?", "How to open parties?"],
      responseType: "navigation-only",
      sectionsIncluded: [],
    });
  }

  const nav = getNavigationPathWithShortcut(focus);

  if (!nav) {
    const results = searchModules(focus, 3);
    if (results.length > 0) {
      const top = results[0];
      const path = top.entry.menuPaths?.[0] || top.entry.menuPath || top.entry.route;
      const shortcut = top.entry.shortcut || undefined;
      return scopeComposed(intent, {
        answer: formatNavAnswer(path, shortcut),
        confidence: 0.5,
        sources: [top.entry.file],
        suggestions: results.map((r) => `Where is ${r.entry.title}?`),
        responseType: "navigation-only",
        sectionsIncluded: ["navigation"],
        matchedModule: top.entry.route,
      });
    }

    return scopeComposed(intent, {
      answer: `I couldn't find a screen for "${focus}". Try using a different term.`,
      confidence: 0.2,
      sources: [],
      suggestions: ["Show me all modules", "What screens are available?"],
      responseType: "navigation-only",
      sectionsIncluded: [],
    });
  }

  return scopeComposed(intent, {
    answer: formatNavAnswer(nav.path, nav.shortcut),
    confidence: 0.9,
    sources: [nav.file],
    suggestions: [],
    responseType: "navigation-only",
    sectionsIncluded: ["navigation"],
    matchedModule: nav.route,
  });
}

function composeStepsOnlyResponse(intent: SmartIntent): ComposedResponse {
  const focus = intent.primaryFocus;
  
  if (!focus) {
    return {
      answer: "Please specify what action you want steps for.",
      confidence: 0.3,
      sources: [],
      suggestions: ["How to create sales invoice?", "Steps to post payment?"],
      responseType: "steps-only",
      sectionsIncluded: [],
    };
  }
  
  const info = resolveModuleInfo(focus);

  if (!info?.moduleDoc?.workflow?.steps) {
    const kbFallback = composeFromKbLastResort(intent, focus, "steps-only", ["steps"]);
    if (kbFallback) return kbFallback;

    return scopeComposed(intent, {
      answer: `I don't have specific steps for "${focus}". Please try a more specific module name.`,
      confidence: 0.3,
      sources: [],
      suggestions: ["How to create sales invoice?", "How to post journal entry?"],
      responseType: "steps-only",
      sectionsIncluded: [],
    });
  }
  
  const stepsSection = composeStepsSection(info);
  let answer = stepsSection;
  
  // Add shortcut hint if available
  const shortcuts = info.moduleDoc.keyboardShortcuts;
  if (shortcuts?.F2) {
    answer += `\n\n💡 Press **F2** to ${shortcuts.F2.toLowerCase()}.`;
  }
  
  return {
    answer,
    confidence: 0.9,
    sources: [info.filePath],
    suggestions: composeFollowUpsSection(info),
    responseType: "steps-only",
    sectionsIncluded: ["steps", "shortcuts"],
    matchedModule: info.route,
  };
}

function composeExplanationResponse(intent: SmartIntent): ComposedResponse {
  const focus = intent.primaryFocus;

  if (!focus) {
    return scopeComposed(intent, {
      answer: "Please specify what you want me to explain.",
      confidence: 0.3,
      sources: [],
      suggestions: ["What is VAT?", "Explain double entry", "What is journal voucher?"],
      responseType: "explanation",
      sectionsIncluded: [],
    });
  }

  const info = resolveModuleInfo(focus);

  if (info?.moduleDoc) {
    const title = `**${info.title}**`;
    const isCompactDefinition =
      intent.falconIntent === "definition" && intent.parsed.complexity === "simple";

    const answer = isCompactDefinition
      ? `${title}\n${info.moduleDoc.description}`
      : intent.falconIntent === "definition"
        ? `${title}\n${[info.moduleDoc.description, info.moduleDoc.purpose].filter(Boolean).join(" ")}`
        : [title, "", info.moduleDoc.description, "", info.moduleDoc.purpose ? `**Purpose:** ${info.moduleDoc.purpose}` : ""]
            .filter(Boolean)
            .join("\n");

    return scopeComposed(intent, {
      answer,
      confidence: 0.9,
      sources: [info.filePath],
      suggestions: composeFollowUpsSection(info),
      responseType: "explanation",
      sectionsIncluded: ["title"],
      matchedModule: info.route,
    });
  }
  
  const kbFallback = composeFromKbLastResort(intent, focus, "explanation", ["title"]);
  if (kbFallback) return kbFallback;

  const results = searchModules(focus, 1);
  if (results.length > 0 && results[0].moduleDoc) {
    const doc = results[0].moduleDoc;
    return scopeComposed(intent, {
      answer: `**${doc.displayName}**\n\n${doc.description}`,
      confidence: 0.7,
      sources: [results[0].entry.file],
      suggestions: [],
      responseType: "explanation",
      sectionsIncluded: ["title"],
      matchedModule: results[0].entry.route,
    });
  }

  return scopeComposed(intent, {
    answer: `I don't have specific information about "${focus}". Could you rephrase or ask about a specific ERP feature?`,
    confidence: 0.2,
    sources: [],
    suggestions: ["What is sales invoice?", "Explain VAT", "What is trial balance?"],
    responseType: "explanation",
    sectionsIncluded: [],
  });
}

function composeCodeAnalysisResponse(intent: SmartIntent): ComposedResponse {
  const focus = intent.primaryFocus || intent.parsed.original;
  const info = focus ? getCodeStructureInfo(focus) : null;
  const results = info ? [] : searchModules(focus, 3);

  if (info) {
    const lines = [
      `**Summary:** ${info.moduleDoc?.description || info.subtitle || info.title} is implemented in \`${info.filePath}\`.`,
      "",
      "**Files Involved:**",
      `- \`${info.filePath}\` (page component: ${info.component})`,
      info.moduleDoc ? `- Route key: \`${info.route}\`` : "",
      "",
      "**Key Functions/Components:**",
      `- **${info.component}** — main UI for ${info.title}`,
    ].filter(Boolean);

    if (info.moduleDoc?.workflow?.steps?.length) {
      lines.push(`- Post/save workflow: ${info.moduleDoc.workflow.steps.slice(-1)[0]}`);
    }

    lines.push("", "**Notes:** Start erp_bot for full cross-file tracing and live code snippets.");

    return scopeComposed(intent, {
      answer: lines.join("\n"),
      confidence: 0.75,
      sources: [info.filePath],
      suggestions: [`Where is ${info.title}?`, `Steps to use ${info.title}`],
      responseType: "code-analysis",
      sectionsIncluded: ["title"],
      matchedModule: info.route,
    });
  }

  if (results.length > 0) {
    const top = results[0];
    return scopeComposed(intent, {
      answer: [
        `**Summary:** Found ${top.entry.title} in the codebase.`,
        "",
        "**Files Involved:**",
        `- \`${top.entry.file}\``,
        "",
        "**Notes:** Start erp_bot for deeper code analysis across store slices and hooks.",
      ].join("\n"),
      confidence: 0.6,
      sources: [top.entry.file],
      suggestions: [],
      responseType: "code-analysis",
      sectionsIncluded: ["title"],
      matchedModule: top.entry.route,
    });
  }

  return scopeComposed(intent, {
    answer:
      "I could not locate matching source files offline. Start **erp_bot** (Ollama) for full codebase search and function tracing.",
    confidence: 0.3,
    sources: [],
    suggestions: ["Which file has journal logic?", "How is VAT calculated in code?"],
    responseType: "code-analysis",
    sectionsIncluded: [],
  });
}

function composeTroubleshootingResponse(intent: SmartIntent): ComposedResponse {
  const focus = intent.primaryFocus;
  const queryLower = intent.parsed.original.toLowerCase();
  
  // Search for matching errors
  const allErrors: Array<{ module: string; error: string; solution: string }> = [];
  
  for (const [moduleId, module] of Object.entries(ERP_MODULES)) {
    for (const error of module.commonErrors || []) {
      const errorText = `${error.error} ${error.solution}`.toLowerCase();
      if (
        (focus && errorText.includes(focus.toLowerCase())) ||
        queryLower.split(" ").some((word) => word.length > 3 && errorText.includes(word))
      ) {
        allErrors.push({ module: moduleId, ...error });
      }
    }
  }
  
  if (allErrors.length > 0) {
    const lines: string[] = [];
    const topErrors = allErrors.slice(0, 3);
    
    if (topErrors.length === 1) {
      lines.push(`**Problem:** ${topErrors[0].error}`);
      lines.push("");
      lines.push(`**Solution:** ${topErrors[0].solution}`);
    } else {
      topErrors.forEach((e, i) => {
        lines.push(`**${i + 1}. ${e.error}**`);
        lines.push(`   → ${e.solution}`);
        lines.push("");
      });
    }
    
    return {
      answer: lines.join("\n").trim(),
      confidence: 0.85,
      sources: allErrors.map((e) => e.module),
      suggestions: ["Show more errors", "How to contact support?"],
      responseType: "troubleshooting",
      sectionsIncluded: ["common-errors"],
    };
  }
  
  // Fallback
  return {
    answer: "I couldn't find a specific solution for this issue. Please describe the error message or what exactly is not working.",
    confidence: 0.3,
    sources: [],
    suggestions: [
      "Trial balance not matching",
      "VAT not calculating",
      "Cannot post voucher",
    ],
    responseType: "troubleshooting",
    sectionsIncluded: [],
  };
}

function composeFieldSpecificResponse(intent: SmartIntent): ComposedResponse {
  const focus = intent.primaryFocus;
  const specificFields = intent.userIntent.specificFields;
  
  if (!focus) {
    return {
      answer: "Please specify which module and field you're asking about.",
      confidence: 0.3,
      sources: [],
      suggestions: [],
      responseType: "field-specific",
      sectionsIncluded: [],
    };
  }
  
  const info = getCodeStructureInfo(focus);
  
  if (!info?.moduleDoc?.keyFields) {
    return {
      answer: `I don't have detailed field information for "${focus}".`,
      confidence: 0.3,
      sources: [],
      suggestions: [],
      responseType: "field-specific",
      sectionsIncluded: [],
    };
  }
  
  const matchingFields = info.moduleDoc.keyFields.filter((f) =>
    specificFields.some(
      (sf) =>
        f.name.toLowerCase().includes(sf) ||
        f.fieldKey.toLowerCase().includes(sf)
    )
  );
  
  if (matchingFields.length === 0) {
    return {
      answer: `I couldn't find fields matching "${specificFields.join(", ")}" in ${info.title}.`,
      confidence: 0.4,
      sources: [info.filePath],
      suggestions: info.moduleDoc.keyFields.slice(0, 3).map((f) => `What is ${f.name}?`),
      responseType: "field-specific",
      sectionsIncluded: [],
      matchedModule: info.route,
    };
  }
  
  const lines: string[] = [];
  matchingFields.forEach((field) => {
    lines.push(`**${field.name}** (${field.required ? "Required" : "Optional"})`);
    lines.push(field.description);
    if (field.validation) {
      lines.push(`_Validation: ${field.validation}_`);
    }
    lines.push("");
  });
  
  return {
    answer: lines.join("\n").trim(),
    confidence: 0.9,
    sources: [info.filePath],
    suggestions: [],
    responseType: "field-specific",
    sectionsIncluded: ["fields"],
    matchedModule: info.route,
  };
}

function composeShortcutResponse(intent: SmartIntent): ComposedResponse {
  const focus = intent.primaryFocus;
  
  // Common shortcuts
  const commonShortcuts: Record<string, string> = {
    F2: "Save/Post the current entry",
    F3: "Add a new record (ledger, item, party)",
    F4: "Enter narration",
    F5: "Refresh page",
    F6: "Change voucher type",
    F8: "Print",
    F9: "Delete current row/item",
    F10: "Toggle column filter",
    F12: "Open settings panel",
    "Ctrl+/": "Toggle Falcon AI",
    "Ctrl+G": "Global search",
    "Ctrl+P": "Print",
    Esc: "Cancel or close modal",
  };
  
  if (focus) {
    const info = getCodeStructureInfo(focus);
    if (info?.moduleDoc?.keyboardShortcuts) {
      const lines = [`**${info.title} Shortcuts:**`, ""];
      for (const [key, action] of Object.entries(info.moduleDoc.keyboardShortcuts)) {
        lines.push(`- **${key}**: ${action}`);
      }
      return {
        answer: lines.join("\n"),
        confidence: 0.95,
        sources: [info.filePath],
        suggestions: [],
        responseType: "shortcut",
        sectionsIncluded: ["shortcuts"],
        matchedModule: info.route,
      };
    }
  }
  
  // Return common shortcuts
  const lines = ["**Common Keyboard Shortcuts:**", ""];
  for (const [key, action] of Object.entries(commonShortcuts)) {
    lines.push(`- **${key}**: ${action}`);
  }
  
  return {
    answer: lines.join("\n"),
    confidence: 0.8,
    sources: ["system"],
    suggestions: ["Shortcuts for sales invoice", "Shortcuts for journal entry"],
    responseType: "shortcut",
    sectionsIncluded: ["shortcuts"],
  };
}

function composeAccountingEntryResponse(intent: SmartIntent): ComposedResponse {
  const focus = intent.primaryFocus;
  
  if (!focus) {
    return {
      answer: "Please specify which transaction you want the accounting entry for.",
      confidence: 0.3,
      sources: [],
      suggestions: ["Journal entry for sales", "Accounting for payment", "Depreciation entry"],
      responseType: "accounting-entry",
      sectionsIncluded: [],
    };
  }
  
  const info = getCodeStructureInfo(focus);
  
  if (info?.moduleDoc?.accountingImpact) {
    const lines: string[] = [];
    lines.push(`**${info.title} — Accounting Effect:**`);
    lines.push("");
    lines.push(info.moduleDoc.accountingImpact);
    
    // Add relevant accounting rules
    if (info.accountingRules?.length > 0) {
      lines.push("");
      lines.push("**Example:**");
      lines.push(info.accountingRules[0].example);
    }
    
    return {
      answer: lines.join("\n"),
      confidence: 0.9,
      sources: [info.filePath],
      suggestions: [],
      responseType: "accounting-entry",
      sectionsIncluded: ["accounting-effect"],
      matchedModule: info.route,
    };
  }
  
  return {
    answer: `I don't have specific accounting entry information for "${focus}".`,
    confidence: 0.3,
    sources: [],
    suggestions: ["Sales invoice accounting", "Payment voucher entry", "Journal entry example"],
    responseType: "accounting-entry",
    sectionsIncluded: [],
  };
}

function composeValidationRulesResponse(intent: SmartIntent): ComposedResponse {
  const focus = intent.primaryFocus;
  
  if (!focus) {
    return {
      answer: "Please specify which module you want validation rules for.",
      confidence: 0.3,
      sources: [],
      suggestions: ["Sales invoice rules", "Journal entry validation", "Party master rules"],
      responseType: "validation-rules",
      sectionsIncluded: [],
    };
  }
  
  const info = getCodeStructureInfo(focus);
  
  if (info?.moduleDoc?.validationRules?.length) {
    const lines: string[] = [];
    lines.push(`**${info.title} — Validation Rules:**`);
    lines.push("");
    info.moduleDoc.validationRules.forEach((rule, i) => {
      lines.push(`${i + 1}. ${rule}`);
    });
    
    return {
      answer: lines.join("\n"),
      confidence: 0.9,
      sources: [info.filePath],
      suggestions: [],
      responseType: "validation-rules",
      sectionsIncluded: ["validation"],
      matchedModule: info.route,
    };
  }
  
  return {
    answer: `I don't have specific validation rules for "${focus}".`,
    confidence: 0.3,
    sources: [],
    suggestions: [],
    responseType: "validation-rules",
    sectionsIncluded: [],
  };
}

function composeGreetingResponse(): ComposedResponse {
  const greetings = [
    "Hello! I'm Falcon, your Sutra ERP assistant. I can help you with invoices, vouchers, reports, and navigation. What would you like to know?",
    "Hi there! I'm Falcon AI, ready to help with your accounting and ERP questions. Ask me anything about Sutra ERP!",
    "Namaste! I'm Falcon, built to guide you through Sutra ERP. What can I help you with today?",
  ];
  
  return {
    answer: greetings[Math.floor(Math.random() * greetings.length)],
    confidence: 1,
    sources: [],
    suggestions: [
      "How do I create a sales invoice?",
      "Where is the balance sheet?",
      "What are the keyboard shortcuts?",
    ],
    responseType: "greeting",
    sectionsIncluded: [],
  };
}

function composeComprehensiveResponse(intent: SmartIntent): ComposedResponse {
  const focus = intent.primaryFocus;
  
  if (!focus) {
    const kbFallback = composeFromKbLastResort(intent, null, "comprehensive", ["title"]);
    if (kbFallback) return kbFallback;

    return {
      answer: "Could you please be more specific? Try asking about a particular module, voucher type, or report.",
      confidence: 0.3,
      sources: [],
      suggestions: [
        "How do I create a sales invoice?",
        "What is journal entry?",
        "Show me the balance sheet",
      ],
      responseType: "comprehensive",
      sectionsIncluded: [],
    };
  }
  
  const info = resolveModuleInfo(focus);

  if (!info) {
    const kbFallback = composeFromKbLastResort(intent, focus, "comprehensive", ["title"]);
    if (kbFallback) return kbFallback;

    return {
      answer: `I couldn't find detailed information for "${focus}". Please try a different term or ask about a specific ERP feature.`,
      confidence: 0.3,
      sources: [],
      suggestions: [],
      responseType: "comprehensive",
      sectionsIncluded: [],
    };
  }
  
  const sections: string[] = [];
  const includedSections: SectionType[] = [];
  
  // Title
  sections.push(`**${info.title}**`);
  if (info.moduleDoc?.description) {
    sections.push(info.moduleDoc.description);
  } else {
    sections.push(composePageOverviewSection(info));
  }
  sections.push("");
  includedSections.push("title");
  
  // Navigation (if should include)
  if (shouldIncludeSection(intent, "navigation")) {
    const nav = composeNavigationSection(info);
    if (nav) {
      sections.push(nav);
      sections.push("");
      includedSections.push("navigation");
    }
  }
  
  // Steps (if should include)
  if (shouldIncludeSection(intent, "steps")) {
    const steps = composeStepsSection(info);
    if (steps) {
      sections.push(steps);
      sections.push("");
      includedSections.push("steps");
    }
  }
  
  // Required fields (if should include)
  if (shouldIncludeSection(intent, "fields")) {
    const fields = composeFieldsSection(info, intent.userIntent.specificFields);
    if (fields) {
      sections.push(fields);
      sections.push("");
      includedSections.push("fields");
    }
  }
  
  // Accounting effect (if should include)
  if (shouldIncludeSection(intent, "accounting-effect")) {
    const accounting = composeAccountingEffectSection(info);
    if (accounting) {
      sections.push(accounting);
      sections.push("");
      includedSections.push("accounting-effect");
    }
  }
  
  // Shortcuts (if should include)
  if (shouldIncludeSection(intent, "shortcuts")) {
    const shortcuts = composeShortcutsSection(info);
    if (shortcuts) {
      sections.push(shortcuts);
      sections.push("");
      includedSections.push("shortcuts");
    }
  }
  
  return {
    answer: sections.join("\n").trim(),
    confidence: 0.85,
    sources: [info.filePath],
    suggestions: composeFollowUpsSection(info),
    responseType: "comprehensive",
    sectionsIncluded: includedSections,
    matchedModule: info.route,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPOSER FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export function composeResponse(intent: SmartIntent): ComposedResponse {
  let response: ComposedResponse;

  switch (intent.responseStrategy) {
    case "navigation-only":
      response = composeNavigationOnlyResponse(intent);
      break;

    case "steps-only":
      response = composeStepsOnlyResponse(intent);
      break;

    case "explanation":
      response = composeExplanationResponse(intent);
      break;

    case "troubleshooting":
      response = composeTroubleshootingResponse(intent);
      break;

    case "field-specific":
      response = composeFieldSpecificResponse(intent);
      break;

    case "shortcut":
      response = composeShortcutResponse(intent);
      break;

    case "accounting-entry":
      response = composeAccountingEntryResponse(intent);
      break;

    case "validation-rules":
      response = composeValidationRulesResponse(intent);
      break;

    case "code-analysis":
      response = composeCodeAnalysisResponse(intent);
      break;

    case "greeting":
      response = composeGreetingResponse();
      break;

    case "comparison":
    case "calculation":
    case "list":
    case "comprehensive":
    default:
      response = composeComprehensiveResponse(intent);
      break;
  }

  if (!response.answer.includes("Path:") && intent.falconIntent !== "general") {
    response = {
      ...response,
      answer: postComposeScope(response.answer, intent.falconIntent),
    };
  }

  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGH-LEVEL API
// ─────────────────────────────────────────────────────────────────────────────

// Note: generatePreciseAnswer is exported from falconBrain.ts
// This function is kept for direct composer access if needed
export function composeFromParsedIntent(intent: SmartIntent): ComposedResponse {
  return composeResponse(intent);
}
