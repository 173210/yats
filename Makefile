ifndef CREDENTIAL
$(error set CREDENTIAL (e.g. CREDENTIAL=consumer_key:consumer_secret))
endif

CREDENTIAL_BASE64 := $(shell echo -n $(CREDENTIAL) | base64)

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

yats.crx: $(addprefix yats/,LICENSE.html manifest.json background.js sandbox.html	\
	search.css search.html search.js import.css import.html import.js)
	chrome --pack-extension=yats $(CHROME_FLAGS)

yats/search.js: search.js | yats
	@echo Processing $<
	@sed -e 's/CREDENTIAL/"Basic $(CREDENTIAL_BASE64)"/' $< $(OUTPUT)

yats/import.js: jszip/dist/jszip.min.js import.js | yats/JSZIP_LICENSE.markdown yats
	@echo Processing $^
	@cat $^ $(OUTPUT)

yats/JSZIP_LICENSE.markdown: jszip/LICENSE.markdown | yats
	cp $< $@

yats/%: % | yats
	cp $< $@

yats:
	mkdir yats

clean:
	rm -rf yats yats.crx
