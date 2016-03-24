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

chrome.omnibox.setDefaultSuggestion({ description: 'Search your tweets' });

chrome.omnibox.onInputEntered.addListener(function(text) {
	chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
		chrome.tabs.update(tabs[0].id, { url: "search.html?q=" + text });
	});
});
