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

const token = oauthFetch("https://api.twitter.com/oauth/request_token",
	{ method: "POST" }, { oauth_callback:
		encodeURIComponent(
			document.location.toString()
				.replace(/[^\/]*?$/, "callback.html")
		)
	})
.then(function(response) {
	return response.text();
}, alert)
.then(function (response) {
	return new Promise(function(resolve, reject) {
		const parsed = parseUri(response);
		sessionStorage.setItem("access", parsed.oauth_token);
		sessionStorage.setItem("accessSecret", parsed.oauth_token_secret);

		resolve(parsed.oauth_token);
	});
}, alert);

const name = new Promise(function(resolve, reject) {
	var name = sessionStorage.getItem("userName");
	if (name) {
		resolve(name);
		return;
	}

	fetch("https://api.twitter.com/1.1/users/lookup.json?user_id="
		+ sessionStorage.getItem("userId"),
		{ method: "GET", headers: {
			"Authorization": "Bearer " + sessionStorage.getItem("bearer") } })
	.then(function(response) {
		return response.json();
	}, reject)
	.then(function(response) {
		name = response[0].screen_name;
		sessionStorage.setItem("userName", name);
		resolve(name);
	}, reject);
});

Promise.all([token, name]).then(function(args) {
	document.location.replace("https://api.twitter.com/oauth/authorize?force_login=true&screen_name="
		+ encodeURIComponent(args[1]) + "&oauth_token=" + args[0]);
}, alert);
