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

yats/%.js: %.js | yats
	uglifyjs $< -c --screw-ie8 --comments /Copyright/ -o $@

yats/%: % | yats
	cp $< $@

yats:
	mkdir yats

clean:
	rm -rf yats yats.crx
