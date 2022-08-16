// ==UserScript==
// @name         AppleGuessr
// @namespace    https://greasyfork.org/en/users/946023-mistystar
// @version      1.0
// @description  Adds Apple Look Around to GeoGuessr
// @author       Mistystar (Mistystar#2205 on Discord, https://www.youtube.com/channel/UC4IHxYw9Aoz8cf9BIdHKd3A on YT)
// @match        https://www.geoguessr.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geoguessr.com
// @grant        none
// @license      MIT
// @run-at       document-start
// @require 	 https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.3/heic2any.min.js

// ==/UserScript==
/*
CREDITS

Massive thank you to the following people:
	- skzk#8049 - Without https://github.com/sk-zk/lookaround-map this script would not have been possible to make
	- Jupaoqq#7742 - I learned a lot from looking at Unity Script's source code
	- mattisinthesky#1294 or kowalski - For hosting the lookaround-map in Heroku and helping with issues
	- efefury#0519 and Apfeloxid#1368 - For making the Take A Look Around Germany map
*/

// BEGIN CODE SECTION
import * as Options from "./options";
import * as Lookaround from "./lookaround";


const MENU_HTML = `
<div class="start-standard-game_settings__x94PU">
	<div class="game-settings_default__DIBgs">
		<div class="game-settings_toggleLabel__nipwm">
			<div class="label_sizeXSmall__mFnrR">Apple Look Around</div>
			<span></span>
		</div>
		<div>
			<input type="checkbox" class="apple-look-around-toggle" checked>
		</div>
	</div>
</div>
`;




const isGamePage = () => location.pathname.startsWith("/challenge/") || location.pathname.startsWith("/results/") ||
						location.pathname.startsWith("/game/")|| location.pathname.startsWith("/battle-royale/") ||
						location.pathname.startsWith("/duels/") || location.pathname.startsWith("/team-duels/") ||
						location.pathname.startsWith("/bullseye/") ||
location.pathname.startsWith("/live-challenge/");

// ----------------------------------------------------------------------------
// Script injection, extracted from extenssr:
// https://gitlab.com/nonreviad/extenssr/-/blob/main/src/injected_scripts/maps_api_injecter.ts
export type GoogleOverrider = (g: typeof window.google) => void;

function overrideOnLoad(googleScript: HTMLScriptElement, observer: MutationObserver, overrider: GoogleOverrider): void {
	const oldOnload = googleScript.onload;
	googleScript.onload = (event) => {
		const google = window.google;
		if (google) {
			observer.disconnect();
			overrider(google);
		}
		if (oldOnload) {
			oldOnload.call(googleScript, event);
		}
	};
}

function grabGoogleScript(mutations: MutationRecord[]): HTMLScriptElement | null {
	for (const mutation of mutations) {
		for (const newNode of (mutation.addedNodes as any /* Please shut up, it works in JS so it must work here as well */)) {
			const asScript = newNode;
			if (asScript && asScript.src && asScript.src.startsWith("https://maps.googleapis.com/")) {
				return asScript;
			}
		}
	}
	return null;
}

function injecter(overrider: GoogleOverrider) {
	if (document.documentElement) {
		injecterCallback(overrider);
	} else {
		alert("Script didn't load, refresh to try loading the script");
	}
}


function injecterCallback(overrider: GoogleOverrider) {
	new MutationObserver((mutations, observer) => {
		const googleScript = grabGoogleScript(mutations);
		if (googleScript) {
			overrideOnLoad(googleScript, observer, overrider);
		}
	}).observe(document.documentElement, { childList: true, subtree: true });
}
// End Script injection --------------------------------------------------------------s

function injectMenu() {
	const inject = () => {
		if (document.querySelector(".apple-look-around-toggle") !== null) return;
		const settingsSection = document.querySelector('.section_sectionMedium__yXgE6');
		if (settingsSection === null) return;
		settingsSection.insertAdjacentHTML("beforeend", MENU_HTML);

		const checkbox = document.querySelector(".apple-look-around-toggle") as HTMLInputElement;
		if (checkbox) {
			let isChecked = localStorage.getItem("applelookaroundchecked");
			if (isChecked === null) {
				checkbox.checked = false;
				localStorage.setItem("applelookaroundchecked", "false");
			} else if (isChecked === "true") {
				checkbox.checked = true;
			} else {
				checkbox.checked = false;
			}

			checkbox.addEventListener("change", (event) => {
				if (event.currentTarget === null) return;
				if ((event.currentTarget as any).checked) {
					localStorage.setItem("applelookaroundchecked", "true");
				} else {
					localStorage.setItem("applelookaroundchecked", "false");
				}
			})
		}
	};

	// We want the page to be loaded before trying to inject anything
	let documentLoadedInterval = setInterval(function() {
		if(document.readyState === "complete") {
			clearInterval(documentLoadedInterval);
			inject();
		}
	}, 100);
}

// ----------------------------------------------------------------------------
// Sate vars 
// TODO: Is there a better way to do this?

var loadingInProgress = false;
var currentPanoID = "";
var currentPanos: Array<String> = [];
var newRound = true;
var curlat = 0;
var curlon = 0;
var curNeighbors = [];
var curHeading = 0;




// ----------------------------------------------------------------------------
// Google Maps API callbacks


// Return a pano image given the panoID.
const getCustomPanoramaTileUrl = (pano, zoom, tileX, tileY) => {

	// Currently loading first image in a round, return a blank image
	if (pano.startsWith("r")){  //&& (currentPanos.length == 0 || newRound)  ) {
		return 'data:image/jpeg;base64,'	
	}

	return currentPanos[tileX];

};

const getPano = (pano) => {
	let rp = Options.RESOLUTION_PROFILES[Options.RESOLUTION_SETTING];
	let fullWidth = 2 * rp.big.width + 2 * rp.small.width - 4 * rp.overlap;
	return {
		location: {
			pano: pano,
			description: "Apple Look Around",
/* 			latLng: {
				lat: curlat,
				lng: curlon
			} */

		},
		links: [],
		// The text for the copyright control.
		copyright: "(C) Apple",
		// The definition of the tiles for this panorama.
		tiles: {
			tileSize: new google.maps.Size(Math.round(fullWidth / 4), Math.round(Options.EXTENSION_FACTOR * rp.big.height)),
			worldSize: new google.maps.Size(fullWidth, Math.round(rp.big.height * Options.EXTENSION_FACTOR)),
			// The heading in degrees at the origin of the panorama
			// tile set.
			centerHeading: curHeading,
			getTileUrl: getCustomPanoramaTileUrl,
		},
	};
};






// ----------------------------------------------------------------------------
// Init

function initLookAround() {
	google.maps.StreetViewPanorama = class extends google.maps.StreetViewPanorama {
		constructor(...args) {
			super(...args);

			let isChecked = localStorage.getItem("applelookaroundchecked");
			if (isChecked === "true") {
				this.registerPanoProvider(getPano);

				// Position is being changed by GeoGuessr at the beginning of each round. this.getPosition() contains lat/lng of round.
				this.addListener("position_changed", () => {
					console.log("Position changed " + this.getPosition());
					try {
						newRound = true;
						this.getFirstPanoId();
					} catch {}
				});

				// Called after setPano(). If the pano is "r<panoId>/<regioId>", then we load the tiles for that pano.
				// If it doesn't start with "r", then loading is done.
				this.addListener("pano_changed", () => {
					console.log("Pano changed " +this.getPano() + " " + currentPanoID);
					if (this.getPano() != null && this.getPano() != currentPanoID && this.getPano() != "" && this.getPano().startsWith("r")) {
						console.log("New pano requested " + this.getPano());
						currentPanoID = this.getPano();
						try {
							this.beginLoadingPanos(this, this.getPano().replace("r", ""));
						} catch {}
					}
				});
				this.addListener("links_changed", () => {
					console.log("Links changed " + this.getLinks());
					if (!this.getPano().startsWith("r") && curNeighbors != null) {


						
						console.log(curNeighbors[0]);
						//this.getLinks().push(curNeighbors[0])
						for (const neighbor of curNeighbors) {
							if (neighbor.pano != "") {
								this.getLinks().push(neighbor);
							}
						}
					}
					
				});
			}
		}

		async getFirstPanoId(){
			let isChecked = localStorage.getItem("applelookaroundchecked");
			if (isChecked !== "true") return;

			try {
				//currentPanos = [loading,loading,loading,loading];
				//this.setPano("loading");
				let lat = this.position.lat();
				let lon = this.position.lng();
				let lookAroundPanoId, regionId;

				let closestObject = await Lookaround.getClosestPano(lat, lon);

				lookAroundPanoId = closestObject.panoid;
				regionId = closestObject.region_id;
				curlat = closestObject.lat;
				curlon = closestObject.lon;
				curHeading = (closestObject.heading + Options.HEADING_CALIBRATION) % 360;
				// Request pano to load
				this.setPano("r"+lookAroundPanoId+"/"+regionId);

			} catch {}

		}

		// param panoFullId is "panoId/regionId"
		async beginLoadingPanos(_t,panoFullId) {
			if (panoFullId === currentPanoID || loadingInProgress) return;

			console.log("Start loading Panos");

			// TODO Update lat,lng and heading
/* 			if (curNeighbors != null) {
				for (const neighbor of curNeighbors) {
					if (neighbor.pano.includes( panoFullId)) {
						curlat = neighbor.lat;
						curlon = neighbor.lon
					}
					
				}
				curNeighbors = [];
			}
 */			
			loadingInProgress = true;
			let pano0 =  Lookaround.loadTileForPano(panoFullId,0);
			let pano1 =  Lookaround.loadTileForPano(panoFullId,1);
			let pano2 =  Lookaround.loadTileForPano(panoFullId,2);
			let pano3 =  Lookaround.loadTileForPano(panoFullId,3);
			loadingInProgress = false;
			currentPanos = [await pano0, await pano1, await pano2, await pano3];

			currentPanoID = panoFullId;
			newRound = false;
			// Set another panoId to refresh the view
			this.setPano(panoFullId);


		}
	}
}

function launchObserver() {
	initLookAround();
	//let observer3 = new MutationObserver((mutations) => {
	//	const PATH_NAME = window.location.pathname;

	//	if (PATH_NAME.startsWith("/maps/") && PATH_NAME.endsWith("/play")) { // Inject the options menu if the path name is /maps/XXXXXXX/play
	//		//injectMenu();
	//	}
	//});
	//observer3.observe(document.body, {childList: true, subtree: true, attributes: false, characterData: false});
}

function onLoad() {
	let isChecked = localStorage.getItem("applelookaroundchecked");
	if (isChecked === null) {
		localStorage.setItem("applelookaroundchecked", "true");
	}

	//const PATH_NAME = window.location.pathname;

	//if (PATH_NAME.startsWith("/maps/") && PATH_NAME.endsWith("/play")) { // Inject the options menu if the path name is /maps/XXXXXXX/play
	//	//injectMenu();
	//}

	injecter(() => {
		launchObserver();
	});
}

(function() {
	onLoad();
})();

window.onload = onLoad;
