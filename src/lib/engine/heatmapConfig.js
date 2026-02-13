export function deriveHeatmapSettings(params = {}, now = Date.now()) {
	const hasHeatmap = params.heatmap !== null && params.heatmap !== undefined;
	const hasRealHeat = Boolean(params.realHeat);

	if (!hasHeatmap && !hasRealHeat) {
		return { enabled: false };
	}

	const settings = {
		enabled: true,
		real: false,
		max: 32000,
		duration: 24,
		end: now,
		radius: 2.5,
		alpha: null,
		manualRedraw: Boolean(params.heatManualRedraw),
		lines: Boolean(params.heatLines),
		filters: Boolean(params.heatfilters || params.heatFilters)
	};

	const duration = parseFloat(params.heatDuration);
	if (!Number.isNaN(duration)) {
		settings.duration = Math.max(0.5, duration);
	}

	const heatEnd = parseFloat(params.heatEnd);
	if (!Number.isNaN(heatEnd)) {
		settings.end = now - heatEnd * 3600 * 1000;
	}

	const alpha = parseFloat(params.heatAlpha);
	if (!Number.isNaN(alpha)) {
		settings.alpha = alpha;
	}

	if (hasRealHeat) {
		settings.real = true;
		settings.max = 50000;
		settings.radius = 1.5;
		settings.blur = 4;
		settings.weight = 0.25;

		const blur = parseFloat(params.heatBlur);
		if (!Number.isNaN(blur)) {
			settings.blur = blur;
		}

		const weight = parseFloat(params.heatWeight);
		if (!Number.isNaN(weight)) {
			settings.weight = weight;
		}
	}

	const radius = parseFloat(params.heatRadius);
	if (!Number.isNaN(radius)) {
		settings.radius = radius;
	}

	const max = parseInt(params.heatmap, 10);
	if (!Number.isNaN(max) && max > 0) {
		settings.max = max;
	}

	return settings;
}
