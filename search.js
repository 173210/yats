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

function resultInit() {
	document.getElementById("result").innerHTML = "";
}

function resultAppend(element) {
	return document.getElementById("result").appendChild(element);
}

function resultAppendText(text) {
	const element = document.createElement("div");
	element.textContent = text;
	return resultAppend(element);
}

window.onerror = resultAppendText;

resultAppendText("Initializing");

function fetchJson(input, init) {
	return fetch(input, init).then(function(response) {
		return response.json();
	}, window.onerror);
}

const token = fetchJson("https://api.twitter.com/oauth2/token", {
	method: "POST",
	headers: {
		"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
		"Authorization": CREDENTIAL
	}, body: "grant_type=client_credentials" });

token.catch(window.onerror);

const open = window.indexedDB.open("tweets", 1);

open.onerror = function(event) {
	window.onerror(event.target.error);
}

function getIteratorOfString(string) {
	function next() {
		if (this.count >= this.value.length) {
			return { done: true };
		} else {
			const value = this.value[this.count];
			this.count++;

			return { done: false, value: value };
		}
	}

	return { next: next, count: 0, value: string };
}

function getTypeOfQuery(string) {
	if (string.length <= 0)
		return null;
	else {
		switch (string) {
		case "OR":
			return "OPCODE";

		default:
			return "STRING";
		}
	}
}

function parseQuery(iterator, block) {
	const queries = [];
	var word;

	function continueWord(from) {
		iterator = getIteratorOfString(from + iterator.value);
	}

	function initializeWord() {
		word = "";
	}

	function finalizeWord() {
		const type = getTypeOfQuery(word);
		if (type)
			queries.push({ type: type, value: word });
	}

	initializeWord();
	while (true) {
		var result = iterator.next();
		if (result.done || result.value == ")")
			break;

		switch (result.value) {
		case " ":
			finalizeWord();
			initializeWord();
			break;

		case "\"":
			var quoted = "";
			while (true) {
				result = iterator.next();
				if (result.done || result.value == "\"")
					break;
				else
					quoted += result.value;
			}

			if (result.done) {
				word += "\"";
				continueWord(quoted);
			} else if (word.length > 0) {
				const query = { type: "STRING", value: word + quoted };
				queries.push(query);
				initializeWord();
			}

			break;

		case "(":
			if (word.length > 0) {
				word += result.value;
			} else {
				const query = { type: "BLOCK" };
				query.value = parseQuery(iterator, true);
				if (query.value)
					queries.push(query);
			}

			break;

		case ")":
			if (block) {
				finalizeWord();
				return queries;
			} else {
				word += result.value;
				break;
			}

		case "-":
			if (word.length > 0)
				word += result.value;
			else
				queries.push({ type: "OPCODE", value: "NOT" });

			break;

		default:
			word += result.value;
			break;
		}
	}

	finalizeWord();
	return queries;
}

function matchString(string, value) {
	return value.text.toUpperCase().indexOf(string.toUpperCase()) >= 0;
}

function matchQuery(value, queries) {
	var r;
	var opcode = null;
	queries.some(function(query) {
		var cur;

		switch (query.type) {
		case "STRING":
			cur = matchString(query.value, value);
			break;

		case "OPCODE":
			if (opcode) {
				r = false;
				return true;
			}

			opcode = query.value;
			break;

		case "BLOCK":
			cur = matchQuery(value, query.value);
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
				r = matchString(opcode, value) && cur;
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

function matchAll(value, query) {
	const formAfterValue = document.getElementById("form-after").value;
	const formBeforeValue = document.getElementById("form-before").value;
	const formReplyIsChecked = document.getElementById("form-reply").checked;
	const formRtIsChecked = document.getElementById("form-rt").checked;

	return (!formAfterValue || new Date(formAfterValue) <= value.timestamp)
		&& (!formBeforeValue || new Date(formBeforeValue) >= value.timestamp)
		&& (!formReplyIsChecked || value.in_reply_to_user_id)
		&& (!formRtIsChecked || value.retweeted_status_id)
		&& excludedSources.indexOf(value.source) < 0
		&& matchQuery(value, query);
}

var last;

function getTweetOriginUserId(tweet) {
	return tweet.retweeted_status_user_id ?
		tweet.retweeted_status_user_id : tweet.user_id;
}

function chainShowTweets(users, tweets) {
	if (last &&
		document.body.scrollTop + document.documentElement.clientHeight
			< last.offsetTop + last.clientHeight)
	{
		return;
	}

	const tweet = tweets.pop();
	if (!tweet)
		return;

	const tweetOriginUserId = getTweetOriginUserId(tweet);

	if (tweet.html_expire < new Date())
		tweet.html = undefined;

	var oembed;
	if (!tweet.html) {
		oembed = fetchJson("https://api.twitter.com/1/statuses/oembed.json?omit_script=true&id="
			+ encodeURIComponent(tweet.tweet_id), { method: "GET" });
	}

	const image = document.createElement("img");
	image.className = "image";
	image.setAttribute("src", users[tweetOriginUserId]);

	const text = document.createElement("span");
	text.className = "text";

	const top = document.createElement("p");
	top.appendChild(image);
	top.appendChild(text);
	last = resultAppend(top);

	if (tweet.html) {
		text.innerHTML = tweet.html;
		window.onscroll();
	} else {
		oembed.then(function(oembedResponse) {
			if (oembedResponse.html) {
				text.innerHTML = oembedResponse.html;

				tweet.html_expire = new Date(Date.now() + oembedResponse.cache_age);
				tweet.html = oembedResponse.html;

				const transaction = open.result.transaction("tweets", "readwrite");
				transaction.onerror = open.onerror;
				transaction.objectStore("tweets").put(tweet)
					.onerror = open.onerror;
			} else {
				text.textContent = oembedResponse.error;
			}

			window.onscroll();
		}, window.onerror);
	}
}

function chainInitializeResult(users, tweets) {
	resultInit();
	window.onerror = alert;
	window.onscroll = function() {
		result.style.height = last.offsetTop + last.clientHeight + tweets.length * 40 + "px";
		chainShowTweets(users, tweets);
	}

	chainShowTweets(users, tweets);
}

function chainGetUserObjectsContainer(users, tweets, token) {
	const userObjects = [];

	function chainGetUserObjects(left) {
		const max = 100;

		if (left.length <= 0) {
			chainInitializeResult(userObjects, tweets);
			return;
		}

		const request = fetchJson("https://api.twitter.com/1.1/users/lookup.json?user_id="
					+ left.slice(-max).join(","), {
				method: "POST",
				headers: { "Authorization": "Bearer " + token }
			});

		if (left.length > max)
			left.length -= max;
		else
			left.length = 0;

		request.then(function(response) {
			for (const user of response)
				userObjects[user.id] = user.profile_image_url_https;

			chainGetUserObjects(left);
		});
	}

	chainGetUserObjects(users);
}

open.onsuccess = function() {
	const progress = resultAppendText("Searching");
	const users = [];
	const tweets = [];

	token.then(function(response) {
		open.result.transaction("tweets", "readonly")
			.objectStore("tweets")
			.openCursor()
			.onsuccess = function(event)
		{
			const cursor = event.target.result;
			if (cursor) {
				const value = cursor.value;
				if (matchAll(value, query)) {
					tweets.push(value);

					const user = getTweetOriginUserId(value);
					if (users.indexOf(user) < 0)
						users.push(user);

					progress.textContent = "Searching (found "
						+ tweets.length
						+ " tweets)";
				}

				cursor.continue();
			} else {
				chainGetUserObjectsContainer(users, tweets,
					response.access_token);
			}
		}

		open.result.transaction("sources", "readonly")
			.objectStore("sources")
			.openCursor()
			.onsuccess = function(event)
		{
			const cursor = event.target.result;
			if (!cursor)
				return;

			const input = document.createElement("input");
			input.name = "exsrc";
			input.type = "checkbox";
			input.value = cursor.key;

			if (excludedSources.indexOf(cursor.key) >= 0)
				input.setAttribute("checked", "checked");

			const div = document.createElement("div");
			div.appendChild(input);
			div.innerHTML += cursor.value;

			document.getElementById("form-exclude-source").appendChild(div);

			cursor.continue();
		}
	}, window.onerror);
}

open.onupgradeneeded = function() {
	resultAppendText("Initialized");
	resultAppendText("Creating database");
	const store = open.result.createObjectStore("tweets", { keyPath : "tweet_id" });
	const col = [ { title: "user_id", unique: false },
		{ title: "in_reply_to_status_id", unique: false },
		{ title: "in_reply_to_user_id", unique: false },
		{ title: "timestamp", unique: false },
		{ title: "source", unique: false },
		{ title: "text", unique: false },
		{ title: "retweeted_status_id", unique: false },
		{ title: "retweeted_status_user_id", unique: false },
		{ title: "retweeted_status_timestamp", unique: false },
		{ title: "expanded_urls", unique: false },
		{ title: "html_expire", unique: false },
		{ title: "html", unique: false }];
	for (v of col)
		store.createIndex(v.title, v.title, { unique: v.unique });

	open.result.createObjectStore("sources", { autoIncrement: true });

	function move() {
		window.location = "import.html";
	}

	token.then(move, move);
}

var query;
const excludedSources = [];
for (const option of window.location.search.substring(1).split("&")) {
	const matched = option.match(/^(.*?)=(.*)/);
	switch (matched[1]) {
	case "after":
		document.getElementById("form-after").value
			= decodeURIComponent(matched[2]);
		break;

	case "before":
		document.getElementById("form-before").value
			= decodeURIComponent(matched[2]);
		break;

	case "q":
		const rawQuery = decodeURIComponent(matched[2]);
		query = parseQuery(getIteratorOfString(rawQuery, false));
		document.getElementById("form-query").value = rawQuery;
		break;

	case "reply":
		document.getElementById("form-reply").checked
			= matched[2] == "on";
		break;

	case "rt":
		document.getElementById("form-rt").checked
			= matched[2] == "on";
		break;

	case "exsrc":
		excludedSources.push(parseInt(matched[2]));
		break;
	}
}
