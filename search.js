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

open.onerror = function(event) {
	alert(event.target.error);
}

function getIteratorOfString(string) {
	function next() {
		if (this.count >= this.value.length) {
			return { done: true };
		} else {
			var value = this.value[this.count];
			this.count++;

			return { done: false, value: value };
		}
	}

	return { next: next, count: 0, value: string };
}

function getTypeOfQuery(string) {
	if (string.length <= 0)
		return null;
	else if (string == "OR")
		return "OPCODE";
	else
		return "STRING";
}

function parse(destination, iterator, block) {
	var string = "";

	while (true) {
		var result = iterator.next();
		if (result.done || result.value == ")")
			break;

		switch (result.value) {
		case " ":
			var query = { type: getTypeOfQuery(string), value: string };
			if (query.type)
				destination.push(query);

			string = "";
			break;

		case "\"":
			while (true) {
				result = iterator.next();
				if (result.done || result.value == "\"")
					break;
				else
					string += result.value;
			}

			if (result.done)
				iterator = getIteratorOfString(string + iterator.value);
			else if (string.length > 0) {
				var query = { type: "STRING", value: string };
				destination.push(query);
			}

			string = "";
			break;

		case "(":
			if (string.length > 0) {
				string += result.value;
			} else {
				var query = { type: "BLOCK", value: [ ] };
				parse(query.value, iterator, true);
				if (query.value.length > 0)
					destination.push(query);
			}

			break;

		case ")":
			if (block) {
				var query = { type: getTypeOfQuery(string), value: string };
				if (query.type)
					destination.push(query);

				return;
			} else {
				string += result.value;
				break;
			}

		case "-":
			if (string.length > 0) {
				string += result.value;
				break;
			} else {
				destination.push({ type: "OPCODE", value: "NOT" });
				break;
			}

		default:
			string += result.value;
			break;
		}
	}

	var query = { type: getTypeOfQuery(string), value: string };
	if (query.type)
		destination.push(query);
}

function matchQuery(queries, text) {
	var r;
	var opcode = null;
	queries.some(function(query) {
		var cur;

		switch (query.type) {
		case "STRING":
			cur = text.indexOf(query.value) >= 0;
			break;

		case "OPCODE":
			if (opcode) {
				r = false;
				return true;
			}

			opcode = query.value;
			break;

		case "BLOCK":
			cur = matchQuery(query.value, text);
			break;

		default:
			throw "Internal error: unexpected type";
		}

		if (cur == undefined)
			return;

		if (r == undefined) {
			switch (opcode) {
			case null:
				r = cur;
				break;

			case "OR":
				r = text.indexOf(opcode) >= 0 && cur;
				break;

			case "NOT":
				r = false;
				return true;

			default:
				throw "Internal error: unexpected opcode";
			}
		} else {
			switch (opcode) {
			case null:
				r = r && cur;
				break;

			case "OR":
				r = r || cur;
				break;

			case "NOT":
				r = r && !cur;
				break;

			default:
				throw "Internal error: unexpected opcode";
			}
		}
	});

	return r;
}

open.onsuccess = function() {
	var queries = [];
	parse(queries, getIteratorOfString(decodeURI(window.location.search.substring(1))), false);

	var store = open.result.transaction("tweets", "readonly").objectStore("tweets");
	store.openCursor().onsuccess = function(event) {
		var cursor = event.target.result;
		if (cursor) {
			var value = cursor.value;
			if (matchQuery(queries, value.text)) {
				var div = document.createElement("div");
				div.className = "timestamp";
				div.textContent = value.retweeted_status_timestamp.length > 0 ?
					value.retweeted_status_timestamp :
					value.timestamp;

				var p = document.createElement("p");

				p.textContent = value.text;
				document.getElementById("result").appendChild(p).appendChild(div);

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
	col.forEach(function(v) {
		store.createIndex(v.title, v.title, { unique: v.unique });
	});

	window.location = "import.html";
}
