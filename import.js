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

"use strict";

function changeStatus(element, status) {
	element.className = status;
}

function start() {
	document.getElementById("file").disabled = true;
	document.getElementById("progress").removeAttribute("value");
}

function abort() {
	document.getElementById("file").disabled = false;
	document.getElementById("progress").setAttribute("value", 0);
}

function finish() {
	changeStatus(document.getElementById("done-status"), "running");
	document.getElementById("progress").setAttribute("value", 1);
}

window.onerror = function(message) {
	const file = document.getElementById("file-status");
	const store = document.getElementById("store-status");
	const done = document.getElementById("done-status");

	abort();
	changeStatus(file, "pending");
	changeStatus(store, "pending");
	changeStatus(done, "pending");
}

function createObjects(rows) {
	const text = document.createElement("textarea");
	const tweets = [];
	const sources = [];

	for (var i = 1; i < rows.length; i++) {
		const tweet = { };
		for (var j = 0; j < rows[i].length; j++) {
			if (!rows[i][j])
				continue;

			text.innerHTML = rows[i][j];
			const key = rows[0][j];
			const value = text.value;
			switch (key) {
			case "user_id":
			case "in_reply_to_user_id":
			case "retweeted_status_user_id":
				tweet[key] = parseInt(value);
				break;

			case "timestamp":
			case "retweeted_status_timestamp":
				tweet[key] = new Date(value);
				break;

			case "source":
				if (sources.indexOf(value) < 0)
					sources.push(value);
			case "tweet_id":
			case "in_reply_to_status_id":
			case "text":
			case "retweeted_status_id":
				tweet[key] = value;
				break;
			}
		}

		tweets.push(tweet);
	}

	return { tweets: tweets, sources: sources };
}

function parse(csv) {
	const rows = [];
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
	}

	return rows;
}

const file = new Promise(function(resolve, reject) {
	document.getElementById("file").onchange = function() {
		start();
		changeStatus(document.getElementById("file-status"), "running");

		const reader = new FileReader();
		reader.onerror = reject;
		reader.onload = function(readerEvent) {
			const zip = new JSZip(readerEvent.target.result);

			document.getElementById("sandbox").contentWindow
				.postMessage(zip.file("data/js/user_details.js").asText(), "*");

			const objects = createObjects(parse(zip.file("tweets.csv").asText()));

			window.onmessage = function(messageEvent) {
				objects.user = messageEvent.data;
				resolve(objects);
			}
		}

		reader.readAsArrayBuffer(this.files[0]);
	}
});

const db = new Promise(function(resolve, reject) {
	const open = window.indexedDB.open("tweets", 1);
	open.onerror = reject;
	open.onsuccess = function() {
		resolve(this.result);
	}
});

function handleErrorEvent(event) {
	window.onerror(event.target.error);
}

function chainStoreTweets(db, tweets, sources) {
	changeStatus(document.getElementById("store-status"), "running");

	const store = db.transaction("tweets", "readwrite").objectStore("tweets");

	var stored = 0;
	for (var i = 0; i < tweets.length; i++) {
		tweets[i].source = sources[tweets[i].source];

		const request = store.add(tweets[i]);
		request.onerror = handleErrorEvent;
		request.onsuccess = function() {
			stored++;
			if (stored >= tweets.length)
				finish();
		}
	}
}

Promise.all([file, db]).then(function(args) {
	const store = args[1].transaction("sources", "readwrite").objectStore("sources");

	var stored = 0;
	const sources = { };
	for (const source of args[0].sources) {
		store.add(source).onsuccess = function(event) {
			sources[source] = event.target.result;
			stored++;
			if (stored >= args[0].sources.length)
				chainStoreTweets(args[1], args[0].tweets, sources);
		}
	}

	const id = parseInt(args[0].user.id);
	for (const tweet of args[0].tweets)
		tweet.user_id = id;

	args[1].transaction("users", "readwrite").objectStore("users")
		.add({ id: id });
}, handleErrorEvent);
