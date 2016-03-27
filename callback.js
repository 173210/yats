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

const parsed = parseUri(window.location.search.substring(1));

if (!parsed.oauth_token || !parsed.oauth_verifier
	|| parsed.oauth_token != sessionStorage.getItem("access"))
{
	alert("Failed to authenticate. Retrying");
	authorize(sessionStorage.getItem("userName"));
}

const token = oauthFetch("https://api.twitter.com/oauth/access_token",
	{ method: "POST", }, {
		oauth_token: parsed.oauth_token,
		oauth_verifier: parsed.oauth_verifier
	}, { secret: sessionStorage.getItem("accessSecret") })
.then(function(response) {
	return response.text().then(function(text) {
		const parsedText = parseUri(text);
		return { id: parseInt(parsedText.user_id),
			oauth_token: parsedText.oauth_token,
			oauth_token_secret: parsedText.oauth_token_secret };
	}, alert);
}, alert);

const db = new Promise(function(resolve, reject) {
	const open = window.indexedDB.open("tweets", 1);
	open.onerror = reject;
	open.onsuccess = function() {
		resolve(this.result);
	}
});

function alertErrorEvent(event) {
	alert(event.target.error);
}

Promise.all([token, db]).then(function(args) {
	const request = args[1].transaction("users", "readwrite")
		.objectStore("users")
		.put(args[0]);

	request.onerror = alertErrorEvent;
	request.onsuccess = function() {
		document.location.replace("search.html?"
			+ sessionStorage.getItem("search"));
	}
}, alertErrorEvent);
