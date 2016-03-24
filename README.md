#Standards
This extension should follow the following standards:

* [ECMAScript 6.0](http://www.ecma-international.org/ecma-262/6.0/index.html)

* [HTML5](https://www.w3.org/TR/html5/)

* [Fetch](https://fetch.spec.whatwg.org/)

#Why Is It Chrome Extension?
Because Twitter API doesn't support CORS. Blame Twitter.

#Hey, I can't build your extension. UglifyJS2 fails.
Because [UglifyJS2 doesn't support ECMAScrpit 6 Harmony yet.](https://github.com/mishoo/UglifyJS2/issues/448)

You have two options:
* Specify `NO_UGLIFY`

Note that the bearer token will be more vulnerable.

* Use `harmony` branch in UglifyJS2.

#LICENSE
    Copyright (C) 2016  173210 <root.3.173210@live.com>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
