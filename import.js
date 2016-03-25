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

window.onerror = alert;

const open = window.indexedDB.open("tweets", 1);
var openDone = false;

function handleErrorEvent(event) {
	window.onerror(event.target.error);
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

open.onerror = handleErrorEvent;

open.onsuccess = function() {
	openDone = true;
}

function parse(csv, onprogress) {
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

		onprogress(rows.length, i, csv.length);
	}

	return rows;
}

function chainStoreTweets(db, tweets, sources) {
	const storeProgress = document.getElementById("store-progress");
	const storeStatus = document.getElementById("store-status");
	changeStatusRunning(storeStatus);

	const store = db.transaction("tweets", "readwrite").objectStore("tweets");

	var stored = 0;
	for (i = 0; i < tweets.length; i++) {
		tweets[i].source = sources[tweets[i].source];

		const request = store.add(tweets[i]);
		request.onerror = handleErrorEvent;
		request.onsuccess = function() {
			stored++;
			if (stored >= tweets.length) {
				const doneStatus = document.getElementById("done-status");
				changeStatusRunning(doneStatus);
				changeStatus(doneStatus,
					"Done (Type \"tweets\" in the omnibox and press tab to search tweets)");
			}
		}

		changeStatus(storeStatus, "Storing ("
			+ i + "/" + tweets.length + " tweets)");

		showProgress(storeProgress, i, tweets.length);
	}
}

function chainStoreSources(user_details, objects) {
	open.onsuccess = function() {
		const db = this.result;
		const store = db.transaction("sources", "readwrite").objectStore("sources");

		var stored = 0;
		const sources = { };
		for (const source of objects.sources) {
			store.add(source).onsuccess = function(event) {
				sources[source] = event.target.result;
				stored++;
				if (stored >= objects.sources.length)
					chainStoreTweets(db, objects.tweets, sources);
			}
		}

		for (tweet of objects.tweets)
			tweet.user_id = parseInt(user_details.id);
	}

	if (openDone)
		open.onsuccess();
}

function createObjects(rows) {
	const text = document.createElement("textarea");
	const tweets = [];
	const sources = [];

	for (var i = 1; i < rows.length; i++) {
		const tweet = { };
		for (var j = 0; j < rows[i].length; j++) {
			text.innerHTML = rows[i][j];
			tweet[rows[0][j]] = text.value;
		}

		function deleteFalseInTweet(key) {
			if (!tweet[key])
				delete tweet[key];
		}

		function parseIntInTweet(key) {
			if (tweet[key])
				tweet[key] = parseInt(tweet[key]);
		}

		function newDateInTweet(key) {
			if (tweet[key])
				tweet[key] = new Date(tweet[key]);
		}

		deleteFalseInTweet("in_reply_to_status_id");
		deleteFalseInTweet("in_reply_to_user_id");
		deleteFalseInTweet("retweeted_status_id");
		deleteFalseInTweet("retweeted_status_user_id");
		deleteFalseInTweet("retweeted_status_timestamp");

		parseIntInTweet("in_reply_to_user_id");
		parseIntInTweet("retweeted_status_user_id");

		newDateInTweet("timestamp");
		newDateInTweet("retweeted_status_timestamp");

		if (sources.indexOf(tweet.source) < 0)
			sources.push(tweet.source);

		tweets.push(tweet);
	}

	return { tweets: tweets, sources: sources };
}

function chainUnzip(raw) {
	const zip = new JSZip(raw);

	changeStatusRunning(document.getElementById("csv-status"));
	const csv = zip.file("tweets.csv").asText();

	const parseProgress = document.getElementById("parse-progress");
	const parseStatus = document.getElementById("parse-status");
	changeStatusRunning(parseStatus);

	const rows = parse(csv, function(entries, parsed, total) {
		changeStatus(parseStatus, "Parsing tweets.csv ("
			+ parsed + "/" + total + " bytes, "
			+ entries + " entries)");

		showProgress(parseProgress, parsed, total);
	});

	changeStatusRunning(document.getElementById("user-status"));

	var messageEvent = null;
	window.onmessage = function(event) {
		messageEvent = event;
	}

	document.getElementById("sandbox").contentWindow
		.postMessage(zip.file("data/js/user_details.js").asText(), "*");

	const objects = createObjects(rows);

	window.onmessage = function(event) {
		chainStoreSources(event.data, objects);
	}

	if (messageEvent)
		window.onmessage(event);

	changeStatusRunning(document.getElementById("user-parse-status"));
}

document.getElementById("file").onchange = function() {
	const file = this;

	file.disabled = true;
	window.onerror = function(message) {
		file.disabled = false;
		alert(message);
	}

	const reader = new FileReader();

	reader.onerror = handleErrorEvent;

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

	reader.onload = function(event) {
		chainUnzip(event.target.result);
	}

	reader.readAsArrayBuffer(this.files[0]);
}
