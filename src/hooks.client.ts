import { handleErrorWithSentry, replayIntegration } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';

const toSampleRate = (value, fallback) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback) => {
	if (value === undefined || value === null || value === '') return fallback;
	const normalized = String(value).trim().toLowerCase();
	if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
	if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
	return fallback;
};

export const init = async () => {
	const dsn = import.meta.env.PUBLIC_SENTRY_DSN;
	if (!dsn) return;
	const isDev = import.meta.env.DEV;
	const environment = import.meta.env.PUBLIC_SENTRY_ENVIRONMENT || (isDev ? 'development' : 'production');
	const enabled = toBoolean(import.meta.env.PUBLIC_SENTRY_ENABLED, true);

	Sentry.init({
		dsn,
		enabled,
		environment,
		release: import.meta.env.PUBLIC_SENTRY_RELEASE || undefined,
		tracesSampleRate: toSampleRate(import.meta.env.PUBLIC_SENTRY_TRACES_SAMPLE_RATE, isDev ? 1.0 : 0.2),
		replaysSessionSampleRate: toSampleRate(import.meta.env.PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE, isDev ? 1.0 : 0.05),
		replaysOnErrorSampleRate: toSampleRate(import.meta.env.PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 1.0),
		integrations: [replayIntegration()],
		maxBreadcrumbs: 50,
		enableLogs: toBoolean(import.meta.env.PUBLIC_SENTRY_ENABLE_LOGS, !isDev),
		ignoreErrors: [
			'AbortError: The operation was aborted',
			'ResizeObserver loop limit exceeded'
		],
		beforeBreadcrumb(breadcrumb) {
			if (breadcrumb.category === 'ui.click') return null;
			return breadcrumb;
		},
		sendDefaultPii: toBoolean(import.meta.env.PUBLIC_SENTRY_SEND_DEFAULT_PII, false),
		beforeSend(event) {
			if (event?.request?.headers) {
				delete event.request.headers.authorization;
				delete event.request.headers.cookie;
			}
			if (event?.user?.ip_address && !toBoolean(import.meta.env.PUBLIC_SENTRY_SEND_DEFAULT_PII, false)) {
				delete event.user.ip_address;
			}
			return event;
		}
	});
};

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = handleErrorWithSentry();
