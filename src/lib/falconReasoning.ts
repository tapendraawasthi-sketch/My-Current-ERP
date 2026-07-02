export type QuestionCategory =
  | 'erp-how-to'
  | 'erp-explain'
  | 'erp-troubleshoot'
  | 'accounting-concept'
  | 'math-calculation'
  | 'general-knowledge'
  | 'current-events'
  | 'web-search-needed'
  | 'code-explanation'
  | 'greeting';

export interface ReasoningStep {
  stepNumber: number;
  title: string;
  thinking: string;
  conclusion: string;
}

export interface ReasoningResult {
  category: QuestionCategory;
  needsWebSearch: boolean;
  searchQuery?: string;
  steps: ReasoningStep[];
  confidence: number;
  suggestedFollowUps: string[];
}

export function classifyQuestion(query: string, currentRoute?: string): QuestionCategory {
  const lowerQuery = query.toLowerCase();

  if (/error|not working|problem|can't|cannot|fail/i.test(lowerQuery)) {
    return 'erp-troubleshoot';
  }
  if (/how|what is|explain|where/i.test(lowerQuery) && /invoice|voucher|ledger|party|item|stock|report/i.test(lowerQuery)) {
    return 'erp-how-to';
  }
  if (/debit|credit|ledger|voucher|vat|tds|balance sheet|profit|loss|depreciation|fifo/i.test(lowerQuery)) {
    return 'accounting-concept';
  }
  if (/[\d\+\-\*\/\%\=]/.test(lowerQuery) && /calculate|math|sum|divided/i.test(lowerQuery)) {
    return 'math-calculation';
  }
  if (/today|latest|current|news|weather|price/i.test(lowerQuery)) {
    return 'current-events';
  }
  if (/search|find online|google|website/i.test(lowerQuery)) {
    return 'web-search-needed';
  }
  if (/code|function|component|typescript|react/i.test(lowerQuery)) {
    return 'code-explanation';
  }
  if (/^(hello|hi|good morning|good evening|hey)/i.test(lowerQuery)) {
    return 'greeting';
  }

  // Check if we are on an ERP route and it looks like an ERP question
  if (currentRoute && !['dashboard', 'home'].includes(currentRoute) && /how|do i|create/i.test(lowerQuery)) {
    return 'erp-how-to';
  }

  return 'general-knowledge';
}

export function buildReasoningChain(query: string, category: QuestionCategory, route?: string): ReasoningStep[] {
  const steps: ReasoningStep[] = [];
  
  steps.push({
    stepNumber: 1,
    title: "Understanding the Question",
    thinking: `Analyzing user intent for: "${query}". Category identified as ${category}.`,
    conclusion: `The user is asking a ${category} question.`
  });

  if (category.startsWith('erp')) {
    steps.push({
      stepNumber: 2,
      title: "Identifying Relevant Module",
      thinking: `Checking current route '${route}' and keywords in the query to find the correct ERP module.`,
      conclusion: `Will provide guidance based on the relevant module documentation.`
    });
    steps.push({
      stepNumber: 3,
      title: "Formulating Guidance",
      thinking: `Extracting step-by-step instructions from the knowledge base for the identified module.`,
      conclusion: `Ready to provide step-by-step instructions.`
    });
  } else if (category === 'current-events' || category === 'web-search-needed') {
    steps.push({
      stepNumber: 2,
      title: "Preparing Web Search",
      thinking: `This question requires up-to-date or external information. Will query a search engine.`,
      conclusion: `Extracting search terms to fetch the latest data.`
    });
  } else if (category === 'math-calculation') {
    steps.push({
      stepNumber: 2,
      title: "Calculation Strategy",
      thinking: `Identifying the mathematical expression in the query to compute the result.`,
      conclusion: `Calculation formula identified.`
    });
  } else {
    steps.push({
      stepNumber: 2,
      title: "Retrieving Knowledge",
      thinking: `Searching general or accounting knowledge base for the answer.`,
      conclusion: `Formulating a concise response based on known facts.`
    });
  }

  return steps;
}

export function shouldSearchWeb(query: string, category: QuestionCategory): boolean {
  return ['current-events', 'web-search-needed'].includes(category) || 
         /price of|weather in|who won|latest news/i.test(query);
}

export function extractSearchQuery(originalQuery: string, category: QuestionCategory): string {
  let query = originalQuery.toLowerCase();
  // Remove common filler words
  query = query.replace(/^(what is|what's|how is|tell me about|search for|find me|can you check|show me) /i, '');
  query = query.replace(/\?$/, '');
  return query.trim();
}

export function generateFollowUps(query: string, category: QuestionCategory, route?: string): string[] {
  if (category === 'erp-how-to' || category === 'erp-troubleshoot') {
    if (route === 'sales-invoice') return ['How do I print this invoice?', 'How to apply a discount?'];
    if (route === 'parties') return ['How to check a customer ledger?', 'How to set a credit limit?'];
    return ['What are the keyboard shortcuts?', 'How do I see reports for this?'];
  }
  
  if (category === 'accounting-concept') {
    return ['How do I enter this in the ERP?', 'Show me an example journal entry.'];
  }

  if (category === 'current-events' || category === 'web-search-needed') {
    return ['Tell me more about this.', 'Search for related news.'];
  }

  return ['What else can you do?', 'Help me with ERP tasks.'];
}

export function analyzeERPContext(route: string): { moduleName: string; likelyIntent: string; suggestions: string[] } {
  const safeRoute = route || 'dashboard';
  const name = safeRoute.replace(/-/g, ' ');
  
  let intent = `Viewing the ${name} page.`;
  let suggestions = ['How do I use this page?', 'What are the shortcuts here?'];

  if (safeRoute.includes('invoice')) {
    intent = 'Likely wants to create or edit an invoice.';
    suggestions = ['How to add items?', 'Why is VAT not calculating?'];
  } else if (safeRoute.includes('reports') || safeRoute.includes('sheet') || safeRoute.includes('balance')) {
    intent = 'Analyzing financial reports.';
    suggestions = ['How to print this report?', 'How to change the date filter?'];
  }

  return {
    moduleName: safeRoute,
    likelyIntent: intent,
    suggestions
  };
}
