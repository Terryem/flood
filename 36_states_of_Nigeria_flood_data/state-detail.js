const profiles = window.NIGERIA_STATES;
const stateNameFromUrl = new URLSearchParams(window.location.search).get("state");
const selectedProfile = profiles.find((state) => state.name.toLowerCase() === (stateNameFromUrl ?? "").toLowerCase()) ?? profiles[0];
const statePicker = document.querySelector("#state-picker");
const formatNumber = new Intl.NumberFormat("en-US");
const nameToSlug = (name) => encodeURIComponent(name);

function riskBand(index) {
	if (index >= 80) return { label: "Very high", color: "#a7473b", background: "#f8e9e6" };
	if (index >= 70) return { label: "High", color: "#a46a24", background: "#fbf1dc" };
	if (index >= 55) return { label: "Moderate", color: "#487b4e", background: "#e7f1e7" };
	return { label: "Lower", color: "#527f65", background: "#edf4ed" };
}

function renderOutlook(profile) {
	const values = Array.from({ length: 7 }, (_, index) => Math.max(12, Math.min(96, profile.riskIndex + Math.round(Math.sin(index * 1.15) * 7) - index)));
	const width = 500;
	const height = 185;
	const padding = { top: 24, right: 22, bottom: 27, left: 20 };
	const plotWidth = width - padding.left - padding.right;
	const plotHeight = height - padding.top - padding.bottom;
	const points = values.map((value, index) => ({
		x: padding.left + (plotWidth * index) / (values.length - 1),
		y: padding.top + plotHeight - (value / 100) * plotHeight,
		value
	}));
	const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
	const area = `${line} L${points.at(-1).x},${height - padding.bottom} L${points[0].x},${height - padding.bottom} Z`;
	const grid = [25, 50, 75].map((value) => {
		const y = padding.top + plotHeight - (value / 100) * plotHeight;
		return `<line class="outlook-grid" x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}"/><text class="outlook-value" x="${padding.left - 10}" y="${y + 3}">${value}</text>`;
	}).join("");
	const pointsMarkup = points.map((point, index) => `<circle class="outlook-point" cx="${point.x}" cy="${point.y}" r="4"><title>Day ${index + 1}: sample risk index ${point.value}</title></circle><text class="outlook-day" x="${point.x}" y="${height - 8}">Day ${index + 1}</text>`).join("");
	document.querySelector("#outlook-chart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="risk-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#5eaa72" stop-opacity=".32"/><stop offset="100%" stop-color="#5eaa72" stop-opacity=".02"/></linearGradient></defs>${grid}<path class="outlook-area" d="${area}"/><path class="outlook-path" d="${line}"/>${pointsMarkup}</svg>`;
}

function renderMap(profile) {
	const mapElement = document.querySelector("#state-map");
	if (!window.L) {
		mapElement.textContent = "Map unavailable. Check your internet connection.";
		return;
	}
	const map = L.map(mapElement, { scrollWheelZoom: false, zoomControl: true });
	L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		maxZoom: 11,
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(map);
	fetch("https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/NGA/ADM1/geoBoundaries-NGA-ADM1_simplified.geojson")
		.then((response) => {
			if (!response.ok) throw new Error(`Boundary request failed: ${response.status}`);
			return response.json();
		})
		.then((boundaries) => {
			const selectedFeature = boundaries.features.find((feature) => {
				const name = feature.properties?.shapeName ?? feature.properties?.shape_name ?? "";
				return name.toLowerCase() === profile.name.toLowerCase() || (profile.name === "FCT" && name.toLowerCase().includes("federal capital"));
			});
			if (!selectedFeature) throw new Error(`Boundary not found for ${profile.name}`);
			const layer = L.geoJSON(selectedFeature, {
				style: { color: "#fff", weight: 2, fillColor: "#23864f", fillOpacity: .55 }
			}).addTo(map);
			map.fitBounds(layer.getBounds(), { padding: [18, 18] });
			map.invalidateSize();
		})
		.catch((error) => {
			mapElement.insertAdjacentHTML("beforeend", '<span class="map-fallback">State outline could not be loaded.</span>');
			console.error(error);
		});
}

function renderProfile(profile) {
	const band = riskBand(profile.riskIndex);
	const hasSampleReport = profile.impact > 0;
	const index = profiles.findIndex((state) => state.name === profile.name);
	document.title = `${profile.name} Flood Brief | NEMA Situation Room`;
	document.querySelector("#state-name").textContent = profile.name === "FCT" ? "FCT" : profile.name;
	document.querySelector("#state-region").textContent = profile.region.toUpperCase();
	document.querySelector("#basin-name").textContent = profile.basin;
	document.querySelector("#risk-index").textContent = profile.riskIndex;
	document.querySelector("#risk-band").textContent = band.label;
	document.querySelector("#risk-summary").style.setProperty("--risk-color", band.color);
	document.querySelector("#risk-band").style.color = band.color;
	document.querySelector("#risk-band").style.background = band.background;
	document.querySelector("#affected-total").textContent = hasSampleReport ? formatNumber.format(profile.impact) : "No report";
	document.querySelector("#affected-note").textContent = hasSampleReport ? "Illustrative dashboard value" : "No sample impact value provided";
	document.querySelector("#risk-label-stat").textContent = band.label;
	document.querySelector("#basin-stat").textContent = profile.basin;
	document.querySelector("#report-status").textContent = hasSampleReport ? "Sample available" : "Not supplied";
	document.querySelector("#forecast-note").innerHTML = `<strong>${band.label} scenario.</strong> The index is a synthetic interface example derived from the profile score, not a measured probability. Replace with dated forecasts and gauge observations.`;
	document.querySelector("#monitoring-priority").textContent = profile.riskIndex >= 70
		? `Watch low-lying communities along the ${profile.basin}.`
		: `Check rainfall and river updates for the ${profile.basin}.`;
	document.querySelector("#driver-list").innerHTML = [
		`Catchment: ${profile.basin}`,
		`Administrative zone: ${profile.region}`,
		"Monitor heavy-rainfall advisories and upstream releases",
		"Check drainage, river levels and community reports"
	].map((text) => `<li>${text}</li>`).join("");
	document.querySelector("#readiness-list").innerHTML = [
		"Share verified warnings through community channels",
		"Identify safe routes and accessible evacuation points",
		"Protect essential medicines and important documents",
		"Report blocked roads, rising water and urgent needs"
	].map((text, itemIndex) => `<div class="readiness-item"><span class="readiness-number">0${itemIndex + 1}</span><p>${text}</p></div>`).join("");
	document.querySelector("#state-position").textContent = `State ${index + 1} of ${profiles.length}`;
	document.querySelector("#previous-state").href = `state.html?state=${nameToSlug(profiles[(index + profiles.length - 1) % profiles.length].name)}`;
	document.querySelector("#next-state").href = `state.html?state=${nameToSlug(profiles[(index + 1) % profiles.length].name)}`;
	renderOutlook(profile);
	renderMap(profile);
}

profiles.forEach((profile) => {
	const option = document.createElement("option");
	option.value = profile.name;
	option.textContent = profile.name;
	statePicker.append(option);
});
statePicker.value = selectedProfile.name;
statePicker.addEventListener("change", () => {
	window.location.href = `state.html?state=${nameToSlug(statePicker.value)}`;
});

renderProfile(selectedProfile);