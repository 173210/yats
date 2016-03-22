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

var token = fetch("https://api.twitter.com/oauth2/token", {
	method: "POST",
	headers: {
		"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
		"Authorization": CREDENTIAL
	}, body: "grant_type=client_credentials" });

token.catch = alert;

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

function fetchGetJson(response) {
	return response.json();
}

var users = { };

// WARNING: Asynchronous function
function popTweets(tweets, tokenResponse) {
	var tweet = tweets.pop();
	if (!tweet)
		return;

	function show() {
		var user = users[tweet.user_id];

		var timestamp = document.createElement("a");
		timestamp.setAttribute("href", "https://twitter.com/"
			+ encodeURI(user.screen_name)
			+ "/statuses/" + encodeURI(tweet.tweet_id));
		timestamp.textContent = tweet.retweeted_status_timestamp.length > 0 ?
			tweet.retweeted_status_timestamp : tweet.timestamp;

		var header = document.createElement("div");
		header.textContent = user.name + " @" + user.screen_name + " \u00B7 ";
		header.appendChild(timestamp);

		var text = document.createElement("p");
		text.className = "text";
		text.textContent = tweet.text;

		var top = document.createElement("p");
		top.appendChild(header);
		top.appendChild(text);
		document.getElementById("result").appendChild(top);

		popTweets(tweets, tokenResponse);
	}

	if (users[tweet.user_id]) {
		show();
	} else
		fetch("https://api.twitter.com/1.1/users/show.json?user_id="
			+ encodeURI(tweet.user_id), {
			method: "GET",
			headers: { "Authorization": "Bearer " + tokenResponse.access_token }
		}).then(fetchGetJson, alert)
			.then(function(showResponse) {
				users[tweet.user_id] = showResponse;
				show();
			}, alert);
}

open.onsuccess = function() {
	var queries = [];
	parse(queries, getIteratorOfString(decodeURI(window.location.search.substring(1))), false);

	var tweets = [];

	token.then(fetchGetJson, alert)
		.then(function(tokenResponse) {
			open.result.transaction("tweets", "readonly")
				.objectStore("tweets")
				.openCursor()
				.onsuccess = function(event)
			{
				var cursor = event.target.result;
				if (cursor) {
					var value = cursor.value;
					if (matchQuery(queries, value.text))
						tweets.push(value);

					cursor.continue();
				} else {
					popTweets(tweets, tokenResponse);
				}
			}
		});
}

open.onupgradeneeded = function() {
	store = open.result.createObjectStore("tweets", { autoIncrement : true });
	const col = [ { title: "user_id", unique: false },
		{ title: "tweet_id", unique: true },
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
