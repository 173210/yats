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

function eventOnerror(event) {
	alert(event.target.error);
}

open.onerror = eventOnerror;

open.onsuccess = function() {
	openDone = true;
}

document.getElementById("file").onchange = function() {
	this.disabled = true;
	var reader = new FileReader();

	reader.onerror = eventOnerror;
	reader.onload = function() {
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
		}

		open.onsuccess = function() {
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

				store.add(object).onerror = eventOnerror;
			}

			alert("Done");
		}

		if (openDone)
			open.onsuccess();
	}

	reader.readAsText(this.files[0]);
}
