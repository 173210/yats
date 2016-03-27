ifndef CONSUMER_KEY
$(error set CONSUMER_KEY)
endif

ifndef CONSUMER_SECRET
$(error set CONSUMER_KEY)
endif

ifdef NO_UGLIFY
OUTPUT = > $@
else
OUTPUT = | uglifyjs -b beautify=false,ascii-only=true -c --screw-ie8 --comments '/!|Copyright/' -o $@
endif

KEYS := $(wildcard *.pem)
ifeq ($(words $(KEYS)),1)
KEY ?= $(KEYS)
endif

ifdef KEY
CHROME_FLAGS := --pack-extension-key=$(KEY)
endif

yats.crx: $(addprefix yats/,manifest.json LICENSE.html LICENSE_SHA1.html	\
	callback.html import.html sandbox.html search.html	\
	js/background.js js/callback.js js/import.js js/search.js js/util.js	\
	css/import.css css/search.css)
	chrome --pack-extension=yats $(CHROME_FLAGS)

yats/js/search.js: js/search.js twitter-text/js/twitter-text.js
	@echo Creating $@
	@cat $^ $(OUTPUT)

yats/js/util.js: js/util.js js/sha1.js | yats/js
	@echo Creating $@
	@sed -e 's/CONSUMER_KEY/"$(CONSUMER_KEY)"/;s/CONSUMER_SECRET/"$(CONSUMER_SECRET)"/' js/util.js | cat - js/sha1.js $(OUTPUT)

yats/js/import.js: js/import.js jszip/dist/jszip.min.js | yats/JSZIP_LICENSE.markdown yats/js
	@echo Creating $@
	@cat $^ $(OUTPUT)

yats/js/%.js: js/%.js | yats/js
	@echo Creating $@
	@cat $^ $(OUTPUT)

yats/css/%.css: css/%.css | yats/css
	cp $< $@

yats/JSZIP_LICENSE.markdown: jszip/LICENSE.markdown | yats
	cp $< $@

yats/%: % | yats
	cp $< $@

yats/css:
	mkdir -p $@

yats/js:
	mkdir -p $@

yats:
	mkdir -p $@

clean:
	rm -rf yats yats.crx
