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
		"Authorization": btoa(consumer_key + ":" + consumer_secret)
	}, body: "grant_type=client_credentials" });

token.catch(window.onerror);

const open = window.indexedDB.open("tweets", 1);

function handleErrorEvent(event) {
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

function chainTweetsShow(origins, tweets) {
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
		const user = origins[tweet.user_id];
		oembed = oauthFetch("https://api.twitter.com/1/statuses/oembed.json",
			{ method: "GET" }, { oauth_token: user.oauth_token }, {
				secret: user.oauth_token_secret,
				body: {
					omit_script: "t",
					id: tweet.tweet_id
				}
			})
		.then(function(response) {
			return response.json();
		}, window.onerror);
	}

	const image = document.createElement("img");
	image.className = "image";
	image.setAttribute("src", origins[tweetOriginUserId]);

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
				transaction.onerror = handleErrorEvent;
				transaction.objectStore("tweets").put(tweet)
					.onerror = handleErrorEvent;
			} else {
				text.textContent = oembedResponse.error;
			}

			window.onscroll();
		}, window.onerror);
	}
}

function chainTweetsInitializeResult(origins, tweets) {
	resultInit();
	window.onerror = alert;
	window.onscroll = function() {
		result.style.height = last.offsetTop + last.clientHeight + tweets.length * 40 + "px";
		chainTweetsShow(origins, tweets);
	}

	chainTweetsShow(origins, tweets);
}

function addUserToUpdateForm(object) {
	const option = document.createElement("option");
	option.setAttribute("value", object.id_str + "," + object.screen_name);
	option.textContent = object.screen_name;
	document.getElementById("form-update-user").appendChild(option);
}

function chainTweetsGetUserObjects(result, users, tokenString) {
	const toLookup = result.origins.copyWithin(0, 0);
	for (const user of users)
		if (toLookup.indexOf(user.id) < 0)
			toLookup.push(user.id);

	var done = 0;
	const requests = [];
	const userNames = [];
	const originImages = [];
	while (done < toLookup.length) {
		const next = done + 100;
		requests.push(fetchJson("https://api.twitter.com/1.1/users/lookup.json?include_entities=false&user_id="
					+ toLookup.slice(done, next).join(","), {
				method: "POST",
				headers: { "Authorization": "Bearer " + tokenString }
			}).then(function(response) {
				for (const object of response) {
					if (result.origins.indexOf(object.id) >= 0)
						originImages[object.id] = object.profile_image_url_https;

					for (const user of users)
						if (user.id == object.id)
							addUserToUpdateForm(object);
				}
			}, window.onerror));

		done = next;
	}

	Promise.all(requests).then(function() {
		chainTweetsInitializeResult(originImages, result.tweets);
	}, window.onerror);
}

function chainSourcesOpen(idb) {
	idb.transaction("sources", "readonly")
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
}

function update(db, user, since, max) {
	const body = {
		user_id: user.id.toString(),
		since_id: since,
		trim_user: "t"
	};

	if (max)
		body.max_id = max;

	oauthFetch("https://api.twitter.com/1.1/statuses/user_timeline.json",
		{ method: "GET" }, { oauth_token: user.oauth_token }, {
		secret: user.oauth_token_secret,
		body: body
	}).then(function (response) {
		return response.json();
	}, window.onerror).then(function(response) {
		const store = db.transaction("tweets", "readwrite").objectStore("tweets");
		var tweet;
		for (tweet of response) {
			const object = {
				tweet_id: tweet.id_str,
				user_id: user.id,
				timestamp: new Date(tweet.created_at),
				source: tweet.source,
				text: tweet.text
			};

			function addIfTrue(destination, source) {
				if (tweet[source])
					object[destination] = tweet[source];
			}

			if (tweet.in_reply_to_status_id_str)
				object.in_reply_to_status_id
					= tweet.in_reply_to_status_id_str;

			if (tweet.in_reply_to_user_id)
				object.in_reply_to_user_id
					= tweet.in_reply_to_user_id;

			if (tweet.retweeted_status) {
				object.retweeted_status_id
					= tweet.retweeted_status.id_str;
				object.retweeted_user_id
					= tweet.retweeted_status.user.id;
				object.retweeted_status_timestamp
					= new Date (tweet.retweeted_status.created_at);
			}

			store.add(object).onerror = handleErrorEvent;
		}

		if (response.length >= 200)
			update(db, user, since, tweet.id_str);
	}, window.onerror);
}

function updater(db, users, tokenString) {
	const target = document.getElementById("form-update-user").value.split(",");
	const targetInt = parseInt(target[0]);
	const request = db.transaction("tweets", "readonly").objectStore("tweets")
		.index("id_timestamp").openCursor(
			IDBKeyRange.bound([targetInt], [targetInt + 1],
					false, false), "prev");

	for (const user of users) {
		if (user.id == targetInt) {
			if (!user.oauth_token || !user.oauth_token_secret) {
				sessionStorage.setItem("search", searchBody);
				sessionStorage.setItem("userId", target[0]);
				sessionStorage.setItem("userName", target[1]);
				authorize(target[1]);
				return;
			}

			request.onsuccess = function(event) {
				const cursor = event.target.result;
				if (cursor)
					update(db, user, cursor.value.tweet_id);
			}

			return;
		}
	}
}

function registerUpdater(db, users, tokenString) {
	document.getElementById("form-update-button").onclick = function() {
		updater(db, users, tokenString);
	}
}

function chainTweetsOpen(idb, tokenString) {
	const tweets = new Promise(function(resolve, reject) {
		const progress = resultAppendText("Searching");
		const request = idb.transaction("tweets", "readonly")
			.objectStore("tweets").openCursor();

		const origins = [];
		const tweets = [];

		request.onerror = reject;
		request.onsuccess = function(tweetsEvent) {
			const cursor = tweetsEvent.target.result;
			if (cursor) {
				const value = cursor.value;
				if (matchAll(value, query)) {
					tweets.push(value);
					const origin = getTweetOriginUserId(value);
					if (origins.indexOf(origin) < 0)
						origins.push(origin);

					progress.textContent = "Searching (found "
						+ tweets.length
						+ " tweets)";
				}

				cursor.continue();
			} else {
				resolve({ origins: origins, tweets: tweets });
			}
		}
	});

	const users = new Promise(function(resolve, reject) {
		const objects = [];
		const request = idb.transaction("users", "readwrite")
			.objectStore("users").openCursor();

		request.onerror = reject;
		request.onsuccess = function(event) {
			const cursor = event.target.result;
			if (cursor) {
				objects.push(cursor.value);
				cursor.continue();
			} else {
				registerUpdater(idb, objects, tokenString);
				resolve(objects);
			}
		}
	});

	Promise.all([tweets, users]).then(function(args) {
		chainTweetsGetUserObjects(args[0], args[1], tokenString);
	}, window.onerror);
}

function chainUseIdb(idb, tokenString) {
	chainSourcesOpen(idb);
	chainTweetsOpen(idb, tokenString);
}

open.onsuccess = function() {
	const db = open.result;

	token.then(function(response) {
		chainUseIdb(db, response.access_token);
	}, window.onerror);
}

open.onupgradeneeded = function() {
	resultAppendText("Initialized");
	resultAppendText("Creating database");

	function create(name, option, indexes) {
		const store = open.result.createObjectStore(name, option);
		for (const name in indexes) {
			const key = indexes[name] ? indexes[name] : name;
			store.createIndex(name, key);
		}
	}

	create("sources", { autoIncrement: true });

	create("tweets", { keyPath : "tweet_id" },
		{ id_timestamp: [ "user_id", "timestamp" ]});

	create("users", { keyPath: "id" });

	function move() {
		window.location = "import.html";
	}

	token.then(move, move);
}

var query;
const excludedSources = [];
const searchBody = window.location.search.substring(1);
for (const option of searchBody.split("&")) {
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
		const element = document.createElement('textarea');
		element.innerHTML = decodeURIComponent(matched[2]);
		query = parseQuery(getIteratorOfString(element.value, false));
		document.getElementById("form-query").value = element.value;
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
