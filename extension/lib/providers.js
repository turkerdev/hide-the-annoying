/**
 * TypeSafe Jev Decision Engine for Hide The Annoying
 * Pure AI-powered semantic classifications via System One
 */

export class BaseProvider {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  /**
   * Classifies a user context
   * @param {Object} context - { handle, name, text, bio }
   * @param {Object} settings - extension settings
   * @returns {Promise<{ isAnnoying: boolean, category: string, reason: string, confidence: number, provider: string }>}
   */
  async classify(context, settings) {
    throw new Error('classify() must be implemented by subclass');
  }
}

/**
 * Helper to build the text state representation from social media context
 */
export function formatEvaluationState(context) {
  const parts = [];
  if (context.handle) parts.push(`Profile: @${context.handle}${context.name ? ` (${context.name})` : ''}`);
  if (context.text) parts.push(`Content / Tweet: "${context.text}"`);
  if (context.bio) parts.push(`Bio: "${context.bio}"`);
  return parts.join('\n');
}

/**
 * Builds the standard typed choice questions payload for Jev
 */
export function buildQuestionsPayload(settings) {
  const instructions = settings.prompts?.customInstructions ||
    "Which category does this content belong to? Determine whether it discusses politics, soccer/football, finance/crypto, or is a normal clean topic.";

  const politicsCriteria = settings.prompts?.politicsCriteria ||
    "National, domestic, or international politics in any language: political figures, heads of state, politicians, ministers, candidates, or party leaders mentioned by full name, surname, initials, handles, or nicknames (e.g. Trump, Biden, Harris, Obama, Macron, Starmer, or Turkish political figures like Erdoğan / RTE, Kılıçdaroğlu / KK, Özdağ, İnce / @vekilince, Özel / ÖÖ, İmamoğlu, Yavaş); political parties and member affiliates (e.g. Democrats, Republicans, Tories, Labour, AKP, CHP, MHP, DEM, etc.); government ministries, state bureaucracy, public appointments; legislation, elections, campaigns, voting, protests, and partisan commentary, debate, or political satire.";

  const soccerCriteria = settings.prompts?.soccerCriteria ||
    "Soccer, football, matches, transfers, clubs, leagues, tournaments, or players.";

  const financeCriteria = settings.prompts?.financeCriteria ||
    "Finance: credit cards, bank loans, debt, interest, cryptocurrency, Bitcoin, altcoins, memecoins, buying or selling crypto tokens or coins, stock market, NASDAQ, Wall Street, trading, forex, or financial hustle / get-rich-quick schemes. Explicitly do NOT classify AI/LLM tokens (such as LLM input/output tokens, API context window limits, token usage or exhaustion), AI agents, software development, coding, tech projects, Steam game sales, video game discounts, shopping deals, coupons, or everyday consumer purchases as finance.";

  const criteria = {
    politics: politicsCriteria,
    soccer: soccerCriteria,
    finance: financeCriteria,
    clean: "Normal non-political, non-soccer, non-finance topic (personal updates, everyday life, artificial intelligence, AI agents, LLM input/output tokens or API token usage, software engineering, programming, coding, apps, gaming, Steam sales and game discounts, shopping deals, science, technology, humor)."
  };

  if (settings.categories?.custom && Array.isArray(settings.customKeywords) && settings.customKeywords.length > 0) {
    criteria.custom = `Content matching user keywords: ${settings.customKeywords.join(', ')}`;
  }

  return {
    category: {
      type: 'choice',
      instructions,
      criteria
    }
  };
}

/**
 * Universally parses Jev typed decision model responses
 * Robust across varying response envelopes (TypeSafe Jev, Cloudflare Workers AI, custom proxies)
 */
export function parseDecisionResponse(data, defaultChoice = 'clean') {
  if (!data || typeof data !== 'object') {
    return { choice: defaultChoice, confidence: 1.0 };
  }

  // Universal envelope unwrapping (Cloudflare Workers AI, custom proxies)
  let source = data;
  if (data.result && typeof data.result === 'object' && !Array.isArray(data.result)) {
    if (data.result.category !== undefined || 
        data.result.decision !== undefined || 
        data.result.choice !== undefined || 
        data.result.topic !== undefined || 
        data.result.answers !== undefined || 
        data.result.selected !== undefined) {
      source = data.result;
    }
  }

  // Find target question answer in response
  let answer = source.category ?? 
               source.decision ?? 
               source.choice ?? 
               source.topic ?? 
               source.answers?.category ?? 
               source.answers?.decision ?? 
               source.answers?.choice ?? 
               source.answers?.topic ??
               source.result;

  // Fallback: check inside answers map or inspect first non-metadata key
  if (!answer && source.answers && typeof source.answers === 'object') {
    const values = Object.values(source.answers);
    if (values.length > 0) answer = values[0];
  }
  if (!answer) {
    const candidateKeys = Object.keys(source).filter(
      k => !['id', 'model', 'created', 'usage', 'object', 'status', 'provider', 'success', 'errors', 'messages'].includes(k)
    );
    if (candidateKeys.length > 0) {
      answer = source[candidateKeys[0]];
    }
  }

  let rawChoice = defaultChoice;
  let confidence = 1.0;

  if (typeof answer === 'string') {
    rawChoice = answer;
  } else if (typeof answer === 'number') {
    confidence = answer;
  } else if (answer && typeof answer === 'object') {
    rawChoice = answer.choice ?? 
                answer.selected ?? 
                answer.selected_option ?? 
                answer.value ?? 
                answer.result ?? 
                answer.label ?? 
                answer.category ??
                defaultChoice;

    if (typeof answer.confidence === 'number') {
      confidence = answer.confidence;
    } else if (typeof answer.noul === 'number') {
      confidence = answer.noul;
    } else if (typeof answer.probability === 'number') {
      confidence = answer.probability;
    }
  }

  if (typeof source.confidence === 'number' && confidence === 1.0) {
    confidence = source.confidence;
  } else if (typeof data.confidence === 'number' && confidence === 1.0) {
    confidence = data.confidence;
  }

  const normalized = String(rawChoice).toLowerCase().trim();
  let category = defaultChoice;

  if (normalized.includes('politic')) {
    category = 'politics';
  } else if (normalized.includes('soccer') || normalized.includes('football')) {
    category = 'soccer';
  } else if (normalized.includes('finance') || normalized.includes('crypto')) {
    category = 'finance';
  } else if (normalized.includes('clean') || normalized.includes('normal')) {
    category = 'clean';
  } else if (normalized.includes('custom')) {
    category = 'custom';
  } else {
    category = normalized;
  }

  return { choice: category, confidence };
}

/**
 * Converts parsed decision output into a standardized classification result object
 */
export function formatClassificationResult(rawResponse, settings, providerId = 'jev', providerDisplayName = 'Decision Model') {
  const { choice, confidence } = parseDecisionResponse(rawResponse);

  const categoryMatchesFilter = (
    (choice === 'politics' && settings.categories?.politics !== false) ||
    (choice === 'soccer' && settings.categories?.soccer !== false) ||
    (choice === 'finance' && settings.categories?.finance !== false) ||
    (choice === 'custom' && settings.categories?.custom === true)
  );

  const isAnnoying = choice !== 'clean' && categoryMatchesFilter;
  const confPercent = Math.round((confidence || 1.0) * 100);

  let reason = 'Normal user';
  if (isAnnoying) {
    if (choice === 'politics') reason = `${providerDisplayName} classified: politics content (${confPercent}% conf)`;
    else if (choice === 'soccer') reason = `${providerDisplayName} classified: soccer / football content (${confPercent}% conf)`;
    else if (choice === 'finance') reason = `${providerDisplayName} classified: finance / crypto content (${confPercent}% conf)`;
    else if (choice === 'custom') reason = `${providerDisplayName} classified: custom filter topic (${confPercent}% conf)`;
    else reason = `${providerDisplayName} classified: ${choice} (${confPercent}% conf)`;
  } else if (choice !== 'clean' && !categoryMatchesFilter) {
    reason = `Normal user (${choice} filter is disabled in settings)`;
  }

  return {
    isAnnoying,
    category: isAnnoying ? choice : 'clean',
    reason,
    confidence,
    provider: providerId
  };
}

/**
 * TypeSafe Jev Provider (Universal Decision Engine)
 * Directly configurable with any Jev-compatible decision API (TypeSafe, Cloudflare Clef, self-hosted)
 */
export class TypeSafeJevProvider extends BaseProvider {
  constructor() {
    super('jev', 'TypeSafe Jev (System One)');
  }

  async classify(context, settings) {
    const rawKey = settings.apiKeys?.jev || '';
    const apiKey = rawKey.trim().replace(/^Bearer\s+/i, '');
    let endpoint = (settings.endpoints?.jev || 'https://api.typesafe.ai/v1/systemone').trim();
    let model = (settings.models?.jev || 'jev-latest').trim();

    // If user points to Cloudflare Workers AI, ensure valid /model in JSON body
    if (endpoint.includes('cloudflare.com')) {
      if (model.toLowerCase().includes('flash')) model = 'clef-flash';
      else if (model.toLowerCase().includes('clef')) model = 'clef';
    }

    if (!apiKey) {
      return {
        isAnnoying: false,
        category: 'clean',
        reason: 'API key required. Enter key in extension popup or options.',
        confidence: 0,
        provider: 'jev'
      };
    }

    const state = formatEvaluationState(context);
    const questions = buildQuestionsPayload(settings);

    const payload = {
      model,
      state,
      questions
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errJson = await response.json();
          if (errJson.errors && Array.isArray(errJson.errors) && errJson.errors.length > 0) {
            errorDetail = errJson.errors.map(e => e.message || JSON.stringify(e)).join(', ');
          } else if (errJson.message) {
            errorDetail = errJson.message;
          }
        } catch (_) {
          errorDetail = await response.text().catch(() => '');
        }

        console.warn(`[HideTheAnnoying] API error (${response.status}):`, errorDetail);
        return {
          isAnnoying: false,
          category: 'clean',
          reason: `API error (${response.status})${errorDetail ? ': ' + errorDetail : ''}`,
          confidence: 0,
          provider: 'jev'
        };
      }

      const data = await response.json();
      return formatClassificationResult(data, settings, 'jev', 'Decision Model');
    } catch (err) {
      console.error('[HideTheAnnoying] Fetch error with Decision API:', err);
      let hint = '';
      if (err.message && err.message.toLowerCase().includes('failed to fetch')) {
        hint = ' (Check endpoint URL & ensure extension is reloaded in chrome://extensions)';
      }
      return {
        isAnnoying: false,
        category: 'clean',
        reason: `Network error: ${err.message}${hint}`,
        confidence: 0,
        provider: 'jev'
      };
    }
  }
}

/**
 * Provider Manager
 * Directly delegates all classifications to TypeSafe Jev
 */
export class ProviderManager {
  constructor() {
    this.jevProvider = new TypeSafeJevProvider();
  }

  async classify(context, settings) {
    return await this.jevProvider.classify(context, settings);
  }
}

export const providerManager = new ProviderManager();
