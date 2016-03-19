ifndef CREDENTIAL
$(error set your credential to CREDENTIAL (e.g. key:secret))
endif

KEYS := $(wildcard *.pem)
ifeq ($(words $(KEYS)),1)
KEY ?= $(KEYS)
endif

ifdef KEY
CHROME_FLAGS := --pack-extension-key=$(KEY)
endif

yats.crx: $(addprefix yats/,manifest.json background.js	\
	search.css search.html search.js import.css import.html import.js)
	chrome --pack-extension=yats $(CHROME_FLAGS)

yats/search.js: search.js | yats
	@echo Processing $<
	@sed -e 's/CREDENTIAL/"$(CREDENTIAL)"/' $< | uglifyjs -c --screw-ie8 --comments /Copyright/ -o $@

yats/import.js: jszip/dist/jszip.min.js import.js | yats/JSZIP_LICENSE.markdown yats
	@echo Processing $^
	@cat $^ | uglifyjs -c --screw-ie8 --comments '/!|Copyright/' -o $@

yats/JSZIP_LICENSE.markdown: jszip/LICENSE.markdown | yats
	cp $< $@

yats/%: % | yats
	cp $< $@

yats:
	mkdir yats

clean:
	rm -rf yats yats.crx
