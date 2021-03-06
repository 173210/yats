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

let resultBottom;

function resultInit() {
	const result = document.getElementById("result");
	result.innerHTML = "";
	resultBottom = result.offsetTop;
}

function resultAppend(element) {
	document.getElementById("result").appendChild(element);
	resultBottom = element.offsetTop + element.clientHeight;
}

function resultAppendFragment(fragment) {
	const last = fragment.lastElementChild;
	if (last) {
		document.getElementById("result").appendChild(fragment);
		resultBottom = last.offsetTop + last.clientHeight;
	}
}

function resultAppendText(text) {
	const element = document.createElement("div");
	element.textContent = text;
	resultAppend(element);

	return element;
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
		"Authorization": "Basic " + btoa(consumerKey + ":" + consumerSecret)
	}, body: "grant_type=client_credentials" });

token.catch(window.onerror);

const open = window.indexedDB.open("tweets", 1);

function handleErrorEvent(event) {
	window.onerror(event.target.error);
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
	let word;

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
		let result = iterator.next();
		if (result.done || result.value == ")")
			break;

		switch (result.value) {
		case " ":
			finalizeWord();
			initializeWord();
			break;

		case "\"":
			let quoted = "";
			while (true) {
				result = iterator.next();
				if (result.done || result.value == "\"")
					break;
				else
					quoted += result.value;
			}

			if (result.done) {
				word += "\"";
				iterator = quoted[Symbol.iterator]();
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
				const parsed = parseQuery(iterator, true);
				if (parsed.iterator) {
					queries.push(parsed.query);
					iterator = parsed.iterator;
				} else {
					queries.push.apply(queries, parsed.query);
					return { query: queries };
				}
			}

			break;

		case ")":
			if (block) {
				finalizeWord();
				return { query: queries, iterator: iterator };
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
	return { query: queries };
}

function matchString(string, value) {
	return value.text.toUpperCase().indexOf(string.toUpperCase()) >= 0;
}

function matchQuery(value, queries) {
	let r;
	let opcode = null;
	queries.some(function(query) {
		let cur;

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
	const formReplyIsChecked = document.getElementById("form-reply").checked;
	const formRtIsChecked = document.getElementById("form-rt").checked;

	return (!formReplyIsChecked || value.in_reply_to_user_id)
		&& (!formRtIsChecked || value.retweeted_status_id)
		&& excludedSources.indexOf(value.source) < 0
		&& matchQuery(value, query);
}

function getTweetOriginUserId(tweet) {
	return tweet.retweeted_status_user_id ?
		tweet.retweeted_status_user_id : tweet.user_id;
}

function chainTweetsShow(users, tweets) {
	const fragment = document.createDocumentFragment();

	for (let gap = (document.body.scrollTop + document.documentElement.clientHeight) - resultBottom;
		gap > 0;
		gap -= 40)
	{
		const tweet = tweets.pop();
		if (!tweet)
			break;

		const tweetOriginUserId = getTweetOriginUserId(tweet);

		const image = document.createElement("img");
		image.className = "tweet-image";
		image.setAttribute("src",
			users[tweetOriginUserId].profile_image_url_https);

		const userUri = "https://twitter.com/"
			+ users[tweetOriginUserId].screen_name;

		const timestamp = document.createElement("a");
		timestamp.setAttribute("href", userUri
			+ "/status/" + encodeURI(tweet.tweet_id));
		timestamp.textContent = (tweet.retweeted_status_timestamp ?
			tweet.retweeted_status_timestamp : tweet.timestamp).toLocaleString();

		const name = document.createElement("a");
		name.className = "tweet-header-name";
		name.setAttribute("href", userUri);
		name.textContent = users[tweetOriginUserId].name;

		const meta = document.createElement("span");
		meta.className = "tweet-header-meta";
		meta.appendChild(document.createTextNode(
			" @" + users[tweetOriginUserId].screen_name + " \u00B7 "));
		meta.appendChild(timestamp);

		const header = document.createElement("div");
		header.appendChild(name);
		header.appendChild(meta);

		const text = document.createElement("span");
		text.className = "tweet-text";
		text.innerHTML = twttr.txt.autoLink(tweet.text);

		const imageClear = document.createElement("p");
		imageClear.className = "tweet-image-clear";

		const content = document.createElement("div");
		content.className = "tweet-content";
		content.appendChild(header);
		content.appendChild(text);

		const top = document.createElement("p");
		top.className = "tweet";

		if (tweet.retweeted_status_id) {
			const retweeted = document.createElement("div");
			retweeted.className = "tweet-retweeted";
			retweeted.textContent = "Retweeted by "
				+ users[tweet.user_id].name;

			top.appendChild(retweeted);
		}

		top.appendChild(image);
		top.appendChild(content);
		top.appendChild(imageClear);
		fragment.appendChild(top);
	}

	resultAppendFragment(fragment);
	result.style.height = resultBottom + tweets.length * 40 + "px";
}

function chainTweetsInitializeResult(users, tweets) {
	resultInit();
	window.onerror = alert;
	window.onscroll = function() {
		chainTweetsShow(users, tweets);
	}

	window.onscroll();
}

function addUserToUpdateForm(object) {
	const option = document.createElement("option");
	option.setAttribute("value", object.id_str + "," + object.screen_name);
	option.textContent = object.name + " @" + object.screen_name;
	document.getElementById("form-update-user").appendChild(option);
}

function chainTweetsGetUserObjects(result, registered, users, tokenString) {
	const toLookup = [];

	for (const id of result.origins)
		if (!users[id])
			toLookup.push(id);

	for (const user of registered)
		if (toLookup.indexOf(user.id) < 0)
			toLookup.push(user.id);

	let done = 0;
	const requests = [];
	const userNames = [];
	while (done < toLookup.length) {
		const next = done + 100;
		requests.push(fetchJson("https://api.twitter.com/1.1/users/lookup.json?include_entities=false&user_id="
					+ toLookup.slice(done, next).join(","), {
				method: "POST",
				headers: { "Authorization": "Bearer " + tokenString }
			}).then(function(response) {
				for (const object of response) {
					users[object.id] = object;

					for (const user of registered)
						if (user.id == object.id)
							addUserToUpdateForm(object);
				}
			}, window.onerror));

		done = next;
	}

	Promise.all(requests).then(function() {
		chainTweetsInitializeResult(users, result.tweets);
	}, window.onerror);
}

function findExcludeSource(value) {
	Array.prototype.forEach.call(document.forms["form-search"].elements["exsrc"],
	function(element) {
		if (element.parentNode.lastChild.innerHTML == value)
			return element.parentNode.lastChild;
	});
}

function addSourceToForm(key, value) {
	const input = document.createElement("input");
	input.name = "exsrc";
	input.type = "checkbox";
	input.value = key;

	if (excludedSources.indexOf(key) >= 0)
		input.setAttribute("checked", "checked");

	const text = document.createElement("span");
	text.innerHTML = value;

	const parent = document.createElement("div");
	parent.appendChild(input);
	parent.appendChild(text);

	document.getElementById("form-exclude-source").appendChild(parent);
}

function chainSourcesOpen(idb) {
	idb.transaction("sources", "readonly")
		.objectStore("sources")
		.openCursor()
		.onsuccess = function(event)
	{
		const cursor = event.target.result;
		if (cursor) {
			addSourceToForm(cursor.key, cursor.value);
			cursor.continue();
		}
	}
}

function updateWithTweets(db, objects)
{
	const sources = db.transaction("sources", "readwrite").objectStore("sources");
	const promises = [];

	for (const object of objects) {
		promises.push(new Promise(function(resolve, reject) {
			const source = findExcludeSource(object.source);
			if (source) {
				object.source = source;
				resolve();
			} else {
				const request = sources.add(object.source);
				request.onerror = reject;
				request.onsuccess = function(event) {
					addSourceToForm(event.target.result, object.source);
					object.source = source;
					resolve();
				}
			}
		}));
	}

	Promise.all(promises).then(function() {
		const tweets = db.transaction("tweets", "readwrite").objectStore("tweets");
		for (const object of objects)
			tweets.add(object).onerror = handleErrorEvent;
	}, window.onerror);
}

function update(db, user, since, max) {
	const objects = [];

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
		for (const tweet of response) {
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

			objects.push(object);
		}

		if (response.length < 200)
			updateWithTweets(db, objects);
		else
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
				sessionStorage.setItem("search", window.location.search.substring(1));
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

function searchTweets(idb, resolve, reject) {
	const rawQuery = document.getElementById("form-query").value;
	document.title = rawQuery + " - YATS!";
	const progress = resultAppendText("Searching");

	const bound = {};
	for (const id of ["form-after", "form-before"]) {
		const value = document.getElementById(id).value;
		if (value)
			bound[id] = new Date(value);
	}

	const range = bound["form-after"] ?
		(bound["form-before"] ?
			IDBKeyRange.bound(
				bound["form-after"],
				bound["form-before"],
				false, false) :
			IDBKeyRange.lowerBound(bound["form-afer"])) :
		(bound["form-before"] ?
			IDBKeyRange.upperBound(bound["form-before"]) :
			undefined);

	const request = idb.transaction("tweets", "readonly")
		.objectStore("tweets").index("timestamp")
		.openCursor(range);

	const query = parseQuery(rawQuery[Symbol.iterator]()).query;
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
}

function getUsersAndRegisterUpdater(idb, tokenString, resolve, reject) {
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
}

function chainTweetsInitialSearch(idb, users, tokenString) {
	const tweets = new Promise(function(resolve, reject) {
		searchTweets(idb, resolve, reject);
	});

	const registered = new Promise(function(resolve, reject) {
		getUsersAndRegisterUpdater(idb, tokenString, resolve, reject);
	});

	Promise.all([tweets, registered]).then(function(args) {
		chainTweetsGetUserObjects(args[0], args[1], users, tokenString);
	}, window.onerror);
}

function chainTweetsSecondSearch(idb, users, tokenString) {
	searchTweets(idb, function(tweets) {
		chainTweetsGetUserObjects(tweets, [], users, tokenString);
	}, window.onerror);
}

function updateExcludedSourcesWithForm() {
	const elements = document.forms["form-search"].elements["exsrc"];
	for (let i = 0; i < elements.length; i++) {
		const index = excludedSources.indexOf(elements[i].value);
		if (elements[i].checked) {
			if (index < 0)
				excludedSources.push(elements[i].value);
		} else {
			if (index >= 0)
				delete excludedSources[index];
		}
	}
}

open.onsuccess = function() {
	const db = open.result;

	token.then(function(response) {
		const users = { };

		chainSourcesOpen(db);
		chainTweetsInitialSearch(db, users, response.access_token);

		document.getElementById("form-search").onsubmit = function(event) {
			resultInit();
			updateExcludedSourcesWithForm();
			chainTweetsSecondSearch(db, users, response.access_token);

			const options = [];
			for (let index = 0; index < event.target.length; index++) {
				const input = event.target[index];
				const name = input.name;
				const raw = input.value;
				const encoded = encodeURIComponent(raw);
				switch (input.type) {
					case "checkbox":
						if (input.checked)
							options.push(name + "=" + encoded);
						break;

					case "date":
					case "text":
						if (input.value)
							options.push(name + "=" + encoded);
						break;
				}
			}

			history.pushState(undefined, "",
				window.location.pathname + "?" + options.join("&"));

			return false;
		}

		window.onpopstate = function() {
			setState();
			resultInit();
			chainTweetsSecondSearch(db, users, response.access_token);
		}
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

	create("tweets", { keyPath : "tweet_id" }, {
			id_timestamp: [ "user_id", "timestamp" ],
			timestamp: "timestamp" });

	create("users", { keyPath: "id" });

	function move() {
		window.location = "import.html";
	}

	token.then(move, move);
}

document.getElementById("form-exclude-open").onclick = function() {
	const element = document.getElementById("form-exclude-source");
	if (element.className == "form-exclude-source-open") {
		element.className = "form-exclude-source-close";
		this.textContent = "\u25BC Exclude source";
	} else {
		element.className = "form-exclude-source-open";
		this.textContent = "\u25B2 Exclude source";
	}
}

const excludedSources = [];

function setState() {
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
			const element = document.createElement('textarea');
			element.innerHTML = decodeURIComponent(matched[2]);
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
}

setState();
