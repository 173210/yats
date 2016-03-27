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

function oauthFetch(input, init, authorizationOption, option) {
	if (!option)
		option = {};

	if (!option.secret)
		option.secret = "";

	const authorization = {
		oauth_consumer_key: CONSUMER_KEY,
		oauth_signature_method: "HMAC-SHA1",
		oauth_version: "1.0"
	};

	for (const property in authorizationOption)
		authorization[property] = authorizationOption[property];

	authorization.oauth_nonce
		= Math.round(Math.random() * 9007199254740992.0).toString(36);

	authorization.oauth_timestamp = Math.floor(Date.now() / 1000).toString();

	const parameterObjects = [];
	for (const object of [authorization, option.body])
		for (const property in object)
			parameterObjects.push(
				{ key: property, value: object[property] });

	parameterObjects.sort(function(o, p) {
		if (o.key > p.key)
			return 1;
		else if (o.key < p.key)
			return -1;
		else
			return 0;
	});

	const parameters = [];
	for (const object of parameterObjects)
		parameters.push(object.key + "=" + object.value);

	authorization.oauth_signature
		= encodeURIComponent(b64_hmac_sha1(CONSUMER_SECRET + "&" + option.secret, [
			init.method, encodeURIComponent(input),
			encodeURIComponent(parameters.join("&"))].join("&")));

	const oauth = [];
	for (const property in authorization)
		oauth.push(property + "=\"" + authorization[property] + "\"");

	if (option.body) {
		const bodyStrings = [];
		for (const property in option.body)
			bodyStrings.push(property + "=" + option.body[property]);

		if (bodyStrings)
			input += "?" + bodyStrings.join("&");
	}

	init.headers = { Authorization: "OAuth " + oauth.join(", ") };
	return fetch(input, init);
}

function parseUri(uri) {
	const parsed = { };

	for (const string of uri.split("&")) {
		const matched = string.match(/^(.*?)=(.*)/);
		parsed[matched[1]] = matched[2];
	}

	return parsed;
}

function authorize(name) {
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
		const parsed = parseUri(response);
		sessionStorage.setItem("access", parsed.oauth_token);
		sessionStorage.setItem("accessSecret", parsed.oauth_token_secret);

		document.location.replace("https://api.twitter.com/oauth/authorize?force_login=true&screen_name="
			+ encodeURIComponent(name) + "&oauth_token=" + parsed.oauth_token);
	}, alert);
}
