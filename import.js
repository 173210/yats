/*  Copyright (C) 2016  173210 <root.3.173210@live.com>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. */

window.onerror = alert;

const open = window.indexedDB.open("tweets", 1);
var openDone = false;

function showError(event) {
	alert(event.target.error);
}

function changeStatusRunning(element) {
	element.className = "running";
}

function changeStatus(element, status) {
	element.textContent = status;
}

function showProgress(element, loaded, total) {
	element.value = loaded / total * 100;
}

open.onerror = showError;

open.onsuccess = function() {
	openDone = true;
}

document.getElementById("file").onchange = function() {
	this.disabled = true;

	const reader = new FileReader();

	reader.onerror = showError;

	const readerProgress = document.getElementById("reader-progress");
	const readerStatus = document.getElementById("reader-status");

	reader.onloadstart = function() {
		changeStatusRunning(readerStatus);
	}

	reader.onprogress = function(event) {
		if (event.lengthComputable) {
			changeStatus(readerStatus,
				"Reading (" + event.loaded + "/" + event.total + " bytes)");

			showProgress(readerProgress, event.loaded, event.total);
		}
	}

	const rows = [];

	window.onmessage = function(event) {
		open.onsuccess = function() {
			const storeProgress = document.getElementById("store-progress");
			const storeStatus = document.getElementById("store-status");
			changeStatusRunning(storeStatus);

			const store = open.result
				.transaction("tweets", "readwrite")
				.objectStore("tweets");
			const text = document.createElement("textarea");

			stored = 1;
			for (var i = 1; i < rows.length; i++) {
				const object = { user_id: event.data.id };
				for (var j = 0; j < rows[i].length; j++) {
					text.innerHTML = rows[i][j];
					object[rows[0][j]] = text.value;
					}

				function deleteFalseInObject(key) {
					if (!object[key])
						delete object[key];
				}

				function newDateInObject(key) {
					if (object[key])
						object[key] = new Date(object[key]);
				}

				deleteFalseInObject("in_reply_to_status_id");
				deleteFalseInObject("in_reply_to_user_id");
				deleteFalseInObject("retweeted_status_id");
				deleteFalseInObject("retweeted_status_user_id");
				deleteFalseInObject("retweeted_status_timestamp");

				newDateInObject("timestamp");
				newDateInObject("retweeted_status_timestamp");

				const request = store.add(object);
				request.onerror = showError;
				request.onsuccess = function() {
					stored++;
					if (stored >= rows.length) {
						const doneStatus = document.getElementById("done-status");
						changeStatusRunning(doneStatus);
						changeStatus(doneStatus,
						"Done (Type \"tweets\" in the omnibox and press tab to search tweets)");
					}
				}

				changeStatus(storeStatus, "Storing ("
					+ i + "/" + (rows.length - 1)
					+ " tweets)");

				showProgress(storeProgress, i, rows.length);
			}
		}

		if (openDone)
			open.onsuccess();
	}

	reader.onload = function(event) {
		reader.onprogress(event);
		const zip = new JSZip(this.result);

		changeStatusRunning(document.getElementById("csv-status"));
		const csv = zip.file("tweets.csv").asText();

		const parseProgress = document.getElementById("parse-progress");
		const parseStatus = document.getElementById("parse-status");
		changeStatusRunning(parseStatus);

		var entry = "";
		var row = [];
		for (var i = 0; i < csv.length;) {
			switch (csv[i]) {
			case ",":
				row.push(entry);
				entry = "";
				i++;
				break;

			case "\n":
				row.push(entry);
				rows.push(row);
				entry = "";
				row = [];
				i++;
				break;

			case "\"":
				while (true) {
					i++;
					if (csv[i] == "\"") {
						i++;
						if (csv[i] == "\"") {
							entry += "\"";
						} else {
							break;
						}
					} else {
						entry += csv[i];
					}
				}

				break;

			default:
				entry += csv[i];
				i++;
				break;
			}

			changeStatus(parseStatus, "Parsing tweets.csv ("
				+ i + "/" + csv.length + " bytes, "
				+ rows.length + " entries)");

			showProgress(parseProgress, i, csv.length);
		}

		changeStatusRunning(document.getElementById("user-status"));
		document.getElementById("sandbox").contentWindow
			.postMessage(zip.file("data/js/user_details.js").asText(), "*");

		changeStatusRunning(document.getElementById("user-parse-status"));
	}

	reader.readAsArrayBuffer(this.files[0]);
}
