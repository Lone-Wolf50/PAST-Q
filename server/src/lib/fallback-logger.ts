import { supabase } from './supabase';

export interface FallbackAttempt {
  model_or_service: string;
  status: 'success' | 'failed';
  error_code?: string;
  error_message?: string;
  error_meaning?: string;
}

export interface FallbackLogPayload {
  request_type: 'AI Chat' | 'OCR Pipeline' | 'Insights Generator';
  title: string;
  success: boolean;
  selected_model_or_service: string | null;
  attempts: FallbackAttempt[];
}

export function getErrorMeaning(code: string | number | undefined, message: string | undefined): { code: string; meaning: string } {
  const codeStr = String(code || '').toUpperCase().trim();
  const msgLower = String(message || '').toLowerCase().trim();

  let mappedCode = codeStr;
  let meaning = "An unexpected error occurred.";

  if (codeStr === '401' || msgLower.includes('unauthorized') || msgLower.includes('invalid api key') || msgLower.includes('401')) {
    mappedCode = '401 / UNAUTHORIZED';
    meaning = "Invalid API credentials. The API key or token supplied is incorrect, inactive, or misconfigured.";
  } else if (codeStr === '403' || msgLower.includes('forbidden') || msgLower.includes('403') || msgLower.includes('access_denied')) {
    mappedCode = '403 / FORBIDDEN';
    meaning = "Access denied by the model provider. The request was forbidden, possibly due to billing restrictions or IP blocking.";
  } else if (codeStr === '429' || msgLower.includes('quota') || msgLower.includes('429') || msgLower.includes('rate limit') || msgLower.includes('too many requests')) {
    mappedCode = '429 / RATE_LIMITED';
    meaning = "Too many requests or API quota exceeded. The primary server is temporarily rate limited. The system is auto-routing to the fallback provider.";
  } else if (codeStr === '503' || msgLower.includes('503') || msgLower.includes('overloaded') || msgLower.includes('unavailable') || msgLower.includes('capacity')) {
    mappedCode = '503 / SERVICE_UNAVAILABLE';
    meaning = "The model provider's server is temporarily overloaded, under maintenance, or has no capacity available. Auto-routing to fallback.";
  } else if (codeStr === '500' || msgLower.includes('500') || msgLower.includes('internal server error')) {
    mappedCode = '500 / INTERNAL_ERROR';
    meaning = "The model provider's server encountered an internal processing error. Switched to fallback.";
  } else if (codeStr === '504' || msgLower.includes('504') || msgLower.includes('timeout') || msgLower.includes('etimedout') || msgLower.includes('deadlineexceeded')) {
    mappedCode = '504 / TIMEOUT';
    meaning = "The API call exceeded the request deadline. The connection timed out while waiting for a response.";
  } else if (msgLower.includes('enoent') || msgLower.includes('file not found') || msgLower.includes('no such file')) {
    mappedCode = 'ENOENT / FILE_MISSING';
    meaning = "The required Google Cloud credentials JSON key file is missing on the server. Defaulting to Tesseract local OCR fallback.";
  } else if (msgLower.includes('insufficient text') || msgLower.includes('characters') || msgLower.includes('too short')) {
    mappedCode = 'OCR_INSUFFICIENT_TEXT';
    meaning = "The OCR engine succeeded but extracted less than 50 characters, indicating a blank, unreadable, or noisy scan page. Retrying or routing next.";
  } else if (msgLower.includes('tesseract.js ocr local fallback is disabled') || msgLower.includes('tesseract.js local ocr is disabled')) {
    mappedCode = 'LOCAL_OCR_DISABLED';
    meaning = "Local Tesseract OCR fallback is disabled in production to protect the Node event loop and server CPU from memory depletion. Please check Google Cloud credentials.";
  } else if (msgLower.includes('network') || msgLower.includes('econnrefused') || msgLower.includes('enotfound') || msgLower.includes('fetch failed')) {
    mappedCode = 'NETWORK_ERROR';
    meaning = "Failed to establish a network connection to the model provider's API endpoint (DNS lookup failed or connection refused).";
  } else {
    if (message) {
      meaning = `Provider error: ${message}`;
    }
  }

  return { code: mappedCode || 'UNKNOWN', meaning };
}

export async function logFallbackEvent(payload: FallbackLogPayload) {
  // We only log if:
  // 1. There are multiple attempts (meaning a fallback occurred), or
  // 2. The entire query failed (success === false).
  const hadFallback = payload.attempts.length > 1 || !payload.success;
  if (!hadFallback) return;

  try {
    const { error } = await supabase
      .from('upsa_admin_notifications')
      .insert({
        type: 'signup', // Must match database check constraint ('signup' or 'payment')
        title: `[Fallback] ${payload.title}`,
        message: `${payload.request_type} completed ${payload.success ? 'with fallback' : 'with failure'}. Selected: ${payload.selected_model_or_service || 'None'}.`,
        metadata: {
          is_fallback: true,
          request_type: payload.request_type,
          success: payload.success,
          selected_model_or_service: payload.selected_model_or_service,
          attempts: payload.attempts
        },
        is_read: false
      });
    
    if (error) {
      console.error('[Fallback Logger] Failed to save to Supabase:', error.message);
    }
  } catch (err: any) {
    console.error('[Fallback Logger] Unexpected error:', err.message);
  }
}
