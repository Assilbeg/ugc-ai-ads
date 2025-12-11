import { getRequestConfig } from 'next-intl/server'
import { defaultLocale, locales } from './config'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  let locale = requested

  if (!locale || !locales.includes(locale as any)) {
    locale = defaultLocale
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/e4231377-2382-45db-b33c-82d9e810facf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'H3',
      location: 'i18n/request.ts:11',
      message: 'resolved locale for messages',
      data: { requestLocale: requested, resolvedLocale: locale },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
