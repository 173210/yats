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

function fetchJson(input, init) {
	return fetch(input, init).then(function(response) {
		return response.json();
	}, alert);
}

const token = fetchJson("https://api.twitter.com/oauth2/token", {
	method: "POST",
	headers: {
		"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
		"Authorization": CREDENTIAL
	}, body: "grant_type=client_credentials" });

token.catch(alert);

const open = window.indexedDB.open("tweets", 1);

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

function parse(iterator, block) {
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
				query.value = parse(iterator, true);
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

		case "<":
		case "=":
		case ">":
			word += result.value;
			if (word.length > 1)
				break;

			op = result.value;
			result = iterator.next();
			if (result.done)
				break;

			if (result.value == '=') {
				op += value;
				result = iterator.next();
			}

			dateString = "";
			while (true) {
				if (result.done || result.value == " ")
					break;
				else
					dateString += result.value;

				result = iterator.next();
			}

			const date = new Date(dateString);
			if (!date) {
				continueWord(op[2] ?
					op[2] + dateString : dateString);

				break;
			}

			queries.push({ type: "RANGE", value: { op: op, date: date } });

			initializeWord();
			break;

		default:
			word += result.value;
			break;
		}
	}

	finalizeWord();
	return queries;
}

function matchRange(range, value) {
	const left = value.timestamp;
	const right = range.date;

	switch (range.op) {
	case "<":
		return left < right;

	case "<=":
		return left <= right;

	case "=":
	case "==":
		return left == right;

	case ">":
		return left > right;

	case ">=":
		return left >= right;

	default:
		return false;
	}
}

function matchString(string, value) {
	return value.text.toUpperCase().indexOf(string.toUpperCase()) >= 0;
}

function matchQuery(queries, value) {
	var r;
	var opcode = null;
	queries.some(function(query) {
		var cur;

		switch (query.type) {
		case "RANGE":
			cur = matchRange(query.value, value);
			break;

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
			cur = matchQuery(query.value, value);
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
			+ encodeURI(tweet.tweet_id), { method: "GET" });
	}

	const image = document.createElement("img");
	image.className = "image";
	image.setAttribute("src", users[tweetOriginUserId]);

	const text = document.createElement("span");
	text.className = "text";

	const imageClear = document.createElement("p");
	imageClear.className = "image-clear";

	const top = document.createElement("p");
	top.appendChild(image);
	top.appendChild(text);
	top.appendChild(imageClear);
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
		}, alert);
	}
}

function chainInitializeResult(users, tweets) {
	resultInit();
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
			for (user of response)
				userObjects[user.id] = user.profile_image_url_https;

			chainGetUserObjects(left);
		});
	}

	chainGetUserObjects(users);
}

open.onsuccess = function() {
	resultAppendText("Parsing queries");
	const queries = parse(getIteratorOfString(decodeURI(window.location.search.substring(1))), false);

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
				if (matchQuery(queries, value)) {
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
