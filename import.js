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

window.onerror = function(message) {
	alert(message);
}

var open = window.indexedDB.open("tweets", 4);
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
	var file = this;
	file.disabled = true;

	var reader = new FileReader();

	reader.onerror = showError;

	var readerProgress = document.getElementById("reader-progress");
	var readerStatus = document.getElementById("reader-status");

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

	reader.onload = function(event) {
		reader.onprogress(event);

		var parseProgress = document.getElementById("parse-progress");
		var parseStatus = document.getElementById("parse-status");
		changeStatusRunning(parseStatus);

		var entry = "";
		var rows = [];
		var row = [];
		for (var i = 0; i < this.result.length;) {
			switch (this.result[i]) {
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
					if (this.result[i] == "\"") {
						i++;
						if (this.result[i] == "\"") {
							entry += "\"";
						} else {
							break;
						}
					} else {
						entry += this.result[i];
					}
				}

				break;

			default:
				entry += this.result[i];
				i++;
				break;
			}

			changeStatus(parseStatus, "Parsing ("
				+ i + "/" + this.result.length + " bytes, "
				+ rows.length + " entries)");

			showProgress(parseProgress, i, this.result.length);
		}

		open.onsuccess = function() {
			var storeProgress = document.getElementById("store-progress");
			var storeStatus = document.getElementById("store-status");
			changeStatusRunning(storeStatus);

			var store = open.result
				.transaction("tweets", "readwrite")
				.objectStore("tweets");
			var text = document.createElement("textarea");

			for (i = 1; i < rows.length; i++) {
				var object = { };
				for (var j = 0; j < rows[i].length; j++) {
					text.innerHTML = rows[i][j];
					object[rows[0][j]] = text.value;
					}

				store.add(object).onerror = showError;

				changeStatus(storeStatus, "Storing ("
					+ i + "/" + (rows.length - 1)
					+ " tweets)");

				showProgress(storeProgress, i, rows.length);
			}

			var doneStatus = document.getElementById("done-status");
			changeStatusRunning(doneStatus);
			changeStatus(doneStatus,
				"Done (Type \"tweets\" in the omnibox and press tab to search tweets)");
		}

		if (openDone)
			open.onsuccess();
	}

	reader.readAsText(this.files[0]);
}