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

function resultInit() {
	document.getElementById("result").innerHTML = "";
}

function resultAppend(element) {
	return document.getElementById("result").appendChild(element);
}

function resultAppendText(text) {
	element = document.createElement("div");
	element.textContent = text;
	return resultAppend(element);
}

resultAppendText("Initializing");

const token = fetch("https://api.twitter.com/oauth2/token", {
	method: "POST",
	headers: {
		"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
		"Authorization": CREDENTIAL
	}, body: "grant_type=client_credentials" });

token.catch(alert);

const open = window.indexedDB.open("tweets", 4);

open.onerror = function(event) {
	alert(event.target.error);
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
	else if (string == "OR")
		return "OPCODE";
	else
		return "STRING";
}

function parse(destination, iterator, block) {
	var string = "";

	while (true) {
		const result = iterator.next();
		if (result.done || result.value == ")")
			break;

		switch (result.value) {
		case " ":
			const query = { type: getTypeOfQuery(string), value: string };
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
				const query = { type: "STRING", value: string };
				destination.push(query);
			}

			string = "";
			break;

		case "(":
			if (string.length > 0) {
				string += result.value;
			} else {
				const query = { type: "BLOCK", value: [ ] };
				parse(query.value, iterator, true);
				if (query.value.length > 0)
					destination.push(query);
			}

			break;

		case ")":
			if (block) {
				const query = { type: getTypeOfQuery(string), value: string };
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

	const query = { type: getTypeOfQuery(string), value: string };
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

const users = { };

function popTweets(tweets, tokenResponse, event) {
	if (document.body.scrollTop + document.documentElement.clientHeight
		< result.offsetTop + result.clientHeight)
	{
		return;
	}

	const tweet = tweets.pop();
	if (!tweet)
		return;

	const tweetOriginUserId = tweet.retweeted_status_user_id ?
		tweet.retweeted_status_user_id : tweet.user_id;

	function fetchApi(uri) {
		return fetch(uri, {
				method: "GET",
				headers: { "Authorization": "Bearer " + tokenResponse.access_token }
			}).then(fetchGetJson, alert);
	}

	function show() {
		if (tweet.html_expire < Date.now())
			tweet.html = undefined;

		var oembed;
		if (!tweet.html) {
			oembed = fetchApi("https://api.twitter.com/1/statuses/oembed.json?omit_script=true&id="
				+ encodeURI(tweet.tweet_id));
		}

		const image = document.createElement("img");
		image.className = "image";
		image.setAttribute("src", users[tweetOriginUserId].profile_image_url_https);

		const text = document.createElement("span");
		text.className = "text";

		const imageClear = document.createElement("p");
		imageClear.className = "image-clear";

		const top = document.createElement("p");
		top.appendChild(image);
		top.appendChild(text);
		top.appendChild(imageClear);
		resultAppend(top);

		if (tweet.html) {
			text.innerHTML = tweet.html;
			window.onscroll(event);
		} else {
			oembed.then(function(oembedResponse) {
				if (oembedResponse.html) {
					text.innerHTML = oembedResponse.html;

					tweet.html_expire = Date.now() + oembedResponse.cache_age;
					tweet.html = oembedResponse.html;

					const transaction = open.result.transaction("tweets", "readwrite");
					transaction.onerror = open.onerror;
					transaction.objectStore("tweets").put(tweet)
						.onerror = open.onerror;
				} else {
					text.textContent = oembedResponse.error;
				}

				window.onscroll(event);
			}, alert);

			if (event)
				event.waitUntil(oembed);
		}
	}

	if (users[tweetOriginUserId]) {
		show();
	} else
		fetchApi("https://api.twitter.com/1.1/users/show.json?user_id="
			+ encodeURI(tweetOriginUserId))
		.then(function(showResponse) {
			users[tweetOriginUserId] = showResponse;
			show();
		}, alert);
}

open.onsuccess = function() {
	resultAppendText("Parsing queries");
	const queries = [];
	parse(queries, getIteratorOfString(decodeURI(window.location.search.substring(1))), false);

	const progress = resultAppendText("Searching");
	const tweets = [];

	token.then(fetchGetJson, alert)
		.then(function(tokenResponse) {
			open.result.transaction("tweets", "readonly")
				.objectStore("tweets")
				.openCursor()
				.onsuccess = function(event)
			{
				const cursor = event.target.result;
				if (cursor) {
					const value = cursor.value;
					if (matchQuery(queries, value.text)) {
						tweets.push(value);
						progress.textContent = "Searching (found "
							+ tweets.length
							+ " tweets)";
					}

					cursor.continue();
				} else {
					resultInit();
					window.onscroll = function(event) {
						popTweets(tweets, tokenResponse, event);
					}

					window.onscroll();
				}
			}
		});
}

open.onupgradeneeded = function() {
	resultAppendText("Initialized");
	const progress = resultAppendText("Creating database");
	store = open.result.createObjectStore("tweets", { keyPath : "tweet_id" });
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
	for (var i = 0; i < col.length; i++) {
		store.createIndex(col[i].title, col[i].title, { unique: col[i].unique });
		progress.textContent = "Creating database ("
			+ Math.round(i / col.length) + "%, "
			+ i + "/" + col.length + ")";
	};

	function move() {
		window.location = "import.html";
	}

	token.then(move, move);
}
