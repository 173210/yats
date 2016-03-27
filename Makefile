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

yats.crx: $(addprefix yats/,LICENSE.html LICENSE_SHA1.html	\
	manifest.json background.js callback.html callback.js util.js	\
	import.css import.html import.js sandbox.html	\
	search.css search.html search.js)
	chrome --pack-extension=yats $(CHROME_FLAGS)

yats/search.js: search.js twitter-text/js/twitter-text.js
	@echo Creating $@
	cat $^ $(OUTPUT)

yats/util.js: util.js sha1.js | yats
	@echo Creating $@
	@sed -e 's/CONSUMER_KEY/"$(CONSUMER_KEY)"/;s/CONSUMER_SECRET/"$(CONSUMER_SECRET)"/' util.js | cat - sha1.js $(OUTPUT)

yats/import.js: import.js jszip/dist/jszip.min.js | yats/JSZIP_LICENSE.markdown yats
	@echo Creating $@
	@cat $^ $(OUTPUT)

yats/%.js: %.js | yats
	@echo Creating $@
	cat $^ $(OUTPUT)

yats/JSZIP_LICENSE.markdown: jszip/LICENSE.markdown | yats
	cp $< $@

yats/%: % | yats
	cp $< $@

yats:
	mkdir yats

clean:
	rm -rf yats yats.crx
