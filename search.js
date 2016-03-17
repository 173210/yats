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

var query = window.location.search.substring(1);
var open = window.indexedDB.open("tweets", 4);

open.onerror = function(event) {
	alert(event.target.error);
}

open.onsuccess = function() {
	var store = open.result.transaction("tweets", "readonly").objectStore("tweets");
	store.openCursor().onsuccess = function(event) {
		var cursor = event.target.result;

		if (cursor) {
			var value = cursor.value;
			if (value.text.indexOf(query) > 0) {
				p = document.createElement("p");
				p.textContent = value.text;
				document.getElementById("result").appendChild(p);
			}

			cursor.continue();
		}
	}
}

open.onupgradeneeded = function() {
	store = open.result.createObjectStore("tweets", { autoIncrement : true });
	const col = [{ title: "tweet_id", unique: true },
		{ title: "in_reply_to_status_id", unique: false },
		{ title: "in_reply_to_user_id", unique: false },
		{ title: "timestamp", unique: false },
		{ title: "source", unique: false },
		{ title: "text", unique: false },
		{ title: "retweeted_status_id", unique: false },
		{ title: "retweeted_status_user_id", unique: false },
		{ title: "retweeted_status_timestamp", unique: false },
		{ title: "expanded_urls", unique: false }];
	for (v of col)
		store.createIndex(v.title, v.title, { unique: v.unique });

	window.location = "import.html";
}
