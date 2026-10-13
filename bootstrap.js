const states = window.NIGERIA_STATES;

const regions = [
	{ name: "South South", affected: 101, displaced: 61 },
	{ name: "North East", affected: 83, displaced: 18 },
	{ name: "South East", affected: 42, displaced: 21 },
	{ name: "South West", affected: 22, displaced: 4 },
	{ name: "North Central", affected: 13, displaced: 3 },
	{ name: "North West", affected: 12, displaced: 2 }
];

const monthlyImpact = [
	{ month: "Jan", value: 3 }, { month: "Feb", value: 5 }, { month: "Mar", value: 9 },
	{ month: "Apr", value: 26 }, { month: "May", value: 11 }, { month: "Jun", value: 14 },
	{ month: "Jul", value: 91 }, { month: "Aug", value: 119 }
];

const needs = [
	{ name: "Food", value: 100 }, { name: "Shelter", value: 82 }, { name: "WASH", value: 65 },
	{ name: "Health", value: 59 }, { name: "Livelihood", value: 52 }, { name: "Nutrition", value: 48 },
	{ name: "Education", value: 39 }, { name: "Protection", value: 32 }, { name: "Security", value: 28 }
];

const stateFilter = document.querySelector("#state-filter");
const lgaFilter = document.querySelector("#lga-filter");
const periodFilter = document.querySelector("#period-filter");
const numberFormat = new Intl.NumberFormat("en-US");
let selectedState = "all";
let stateLayer;
let floodMap;

function stateColor(impact) {
	if (impact >= 25000) return "#168454";
	if (impact >= 10000) return "#75b982";
	return "#b8d9bd";
}

function normalizeStateName(name) {
	return name.toLowerCase().includes("federal capital") ? "FCT" : name.trim();
}

function featureState(feature) {
	const properties = feature.properties ?? {};
	return normalizeStateName(properties.shapeName ?? properties.shape_name ?? properties.NAME_1 ?? properties.name ?? "");
}

function styleState(feature) {
	const state = states.find((item) => item.name.toLowerCase() === featureState(feature).toLowerCase());
	const hasReport = state?.impact > 0;
	const selected = selectedState !== "all" && state?.name === selectedState;
	const muted = selectedState !== "all" && !selected;
	return {
		color: selected ? "#153d2a" : "#fff",
		weight: selected ? 3 : 1,
		opacity: muted ? .5 : .95,
		fillColor: hasReport ? stateColor(state.impact) : "#dfe7e0",
		fillOpacity: muted ? .24 : hasReport ? .64 : .48
	};
}

function selectFeature(feature, layer) {
	const name = featureState(feature);
	const state = states.find((item) => item.name.toLowerCase() === name.toLowerCase());
	const report = state?.impact > 0
		? `<strong>${state.name}</strong><br>${numberFormat.format(state.impact)} people affected`
		: `<strong>${name}</strong><br>No illustrative impact value supplied`;
	layer.bindTooltip(report, { sticky: true, className: "state-tooltip" });
	layer.on("click", () => {
		if (!state) {
			layer.bindPopup(`<div class="state-popup"><strong>${name}</strong><br>State profile unavailable.</div>`).openPopup();
			return;
		}
		setState(state.name);
		const impactLine = state.impact > 0 ? `${numberFormat.format(state.impact)} people affected` : "No illustrative impact value supplied";
		const briefUrl = `36_states_of_Nigeria_flood_data/state.html?state=${encodeURIComponent(state.name)}`;
		layer.bindPopup(`<div class="state-popup"><strong>${state.name}</strong><br>${impactLine}<br><a href="${briefUrl}">Open state brief ↗</a></div>`).openPopup();
	});
}

async function renderMap() {
	const mapElement = document.querySelector("#flood-map");
	if (!window.L) {
		mapElement.innerHTML = '<p class="map-loading">The map library could not load. Check your internet connection and reload.</p>';
		return;
	}

	floodMap = L.map(mapElement, { scrollWheelZoom: false, zoomControl: true }).setView([9.1, 8.2], 5.5);
	L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		maxZoom: 10,
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(floodMap);

	try {
		const response = await fetch("https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/NGA/ADM1/geoBoundaries-NGA-ADM1_simplified.geojson");
		if (!response.ok) throw new Error(`Boundary request failed: ${response.status}`);
		const boundaries = await response.json();
		stateLayer = L.geoJSON(boundaries, { style: styleState, onEachFeature: selectFeature }).addTo(floodMap);
		floodMap.fitBounds(stateLayer.getBounds(), { padding: [12, 12] });
		mapElement.querySelector(".map-loading")?.remove();
		floodMap.invalidateSize();
	} catch (error) {
		mapElement.querySelector(".map-loading").textContent = "State boundaries could not be loaded. The base map is still available.";
		mapElement.querySelector(".map-loading").classList.add("map-error");
		console.error(error);
	}
}

function renderRegionChart() {
	const chart = document.querySelector("#regional-chart");
	const periodFactor = periodFilter.value === "july" ? .62 : periodFilter.value === "august" ? .48 : 1;
	chart.innerHTML = regions.map((region) => {
		const selected = states.find((item) => item.name === selectedState);
		const stateFactor = selectedState === "all" ? 1 : !selected?.impact ? 0 : selected.region === region.name ? .55 : .12;
		const factor = stateFactor * periodFactor;
		const affected = Math.round(region.affected * factor);
		const displaced = Math.round(region.displaced * factor);
		return `<div class="region-group${factor < .2 ? " is-muted" : ""}${factor === .55 ? " is-selected" : ""}" title="${region.name}: ${affected}k affected, ${displaced}k displaced"><div class="bar-pair"><span class="bar bar-affected" style="height:${Math.max(4, affected / 119 * 100)}%"><small class="bar-value">${affected}k</small></span><span class="bar bar-displaced" style="height:${Math.max(4, displaced / 119 * 100)}%"><small class="bar-value">${displaced}k</small></span></div><span class="region-label">${region.name.replace(" ", "<br>")}</span></div>`;
	}).join("");
}

function renderTrend() {
	const chart = document.querySelector("#trend-chart");
	const width = 500;
	const height = 180;
	const padding = { top: 25, right: 22, bottom: 26, left: 12 };
	const plotWidth = width - padding.left - padding.right;
	const plotHeight = height - padding.top - padding.bottom;
	const points = monthlyImpact.map((item, index) => ({
		x: padding.left + (plotWidth * index) / (monthlyImpact.length - 1),
		y: padding.top + plotHeight - (item.value / 125) * plotHeight,
		...item
	}));
	const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
	const area = `${line} L${points.at(-1).x},${height - padding.bottom} L${points[0].x},${height - padding.bottom} Z`;
	const grid = [0, 1, 2, 3].map((index) => {
		const y = padding.top + (plotHeight * index) / 3;
		return `<line class="chart-gridline" x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}"/>`;
	}).join("");
	const labels = points.map((point) => `<text class="trend-month" x="${point.x}" y="${height - 7}">${point.month}</text>`).join("");
	const values = points.map((point, index) => `<circle class="trend-point" cx="${point.x}" cy="${point.y}" r="3.5"><title>${point.month}: ${point.value},000 people</title></circle>${index === points.length - 1 || index === 2 || index === 3 || index === 6 ? `<text class="trend-value" x="${point.x}" y="${point.y - 10}">${point.value}k</text>` : ""}`).join("");
	chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#69b782" stop-opacity=".35"/><stop offset="100%" stop-color="#69b782" stop-opacity=".02"/></linearGradient></defs>${grid}<path class="trend-area" d="${area}"/><path class="trend-path" d="${line}"/>${values}${labels}</svg>`;
}

function renderNeeds() {
	document.querySelector("#needs-chart").innerHTML = needs.map((need) => `<div class="need-row" role="listitem"><span class="need-label">${need.name}</span><span class="need-track"><span class="need-fill" style="display:block;width:${need.value}%"></span></span><span class="need-value">${need.value}%</span></div>`).join("");
}

function setState(name) {
	selectedState = name;
	stateFilter.value = name === "all" ? "all" : name;
	const detailsLink = document.querySelector("#state-details-link");
	if (name === "all") {
		detailsLink.hidden = true;
	} else {
		detailsLink.href = `36_states_of_Nigeria_flood_data/state.html?state=${encodeURIComponent(name)}`;
		detailsLink.hidden = false;
	}
	stateLayer?.setStyle(styleState);
	renderRegionChart();
	updateHeadline();
}

function updateHeadline() {
	const selected = states.find((state) => state.name === selectedState);
	if (selected && selected.impact === 0) {
		document.querySelector("#metric-affected").textContent = "—";
		document.querySelector("#metric-displaced").textContent = "—";
		document.querySelector("#metric-fatalities").textContent = "—";
		document.querySelector("#metric-states").textContent = "No report";
		return;
	}
	const periodFactor = periodFilter.value === "july" ? .62 : periodFilter.value === "august" ? .48 : 1;
	const stateFactor = selected ? Math.min(.27, selected.impact / 272890) : 1;
	const factor = stateFactor * periodFactor;
	document.querySelector("#metric-affected").textContent = numberFormat.format(Math.round(272890 * factor));
	document.querySelector("#metric-displaced").textContent = numberFormat.format(Math.round(108117 * factor));
	document.querySelector("#metric-fatalities").textContent = numberFormat.format(Math.max(1, Math.round(230 * factor)));
	document.querySelector("#metric-states").innerHTML = selected ? selected.name === "FCT" ? "FCT" : `1 <small>/ 36</small>` : periodFilter.value === "season" ? `27 <small>/ 36</small>` : `18 <small>/ 36</small>`;
}

function setLgaState() {
	const lgaStates = { maiduguri: "Borno", bama: "Borno", gashua: "Yobe" };
	setState(lgaStates[lgaFilter.value] ?? "all");
}

states.forEach((state) => {
	const option = document.createElement("option");
	option.value = state.name;
	option.textContent = state.name;
	stateFilter.append(option);
});

renderMap();
renderRegionChart();
renderTrend();
renderNeeds();

stateFilter.addEventListener("change", () => {
	lgaFilter.value = "all";
	setState(stateFilter.value);
});
lgaFilter.addEventListener("change", setLgaState);
periodFilter.addEventListener("change", () => {
	updateHeadline();
	renderRegionChart();
});
document.querySelector("#reset-filters").addEventListener("click", () => {
	periodFilter.value = "season";
	stateFilter.value = "all";
	lgaFilter.value = "all";
	setState("all");
});
document.querySelector("#map-reset").addEventListener("click", () => {
	setState("all");
	if (stateLayer) floodMap.fitBounds(stateLayer.getBounds(), { padding: [12, 12] });
});
