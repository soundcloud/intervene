node_modules: package.json
	npm install
	touch "$@"

.PHONY: build
build: node_modules
	npm run build
	cp src/brotli-decode.* dist/src
	cp src/initial-config.ts.txt dist/src

.PHONY: test
test: build
	npm test

.PHONY: unit-test
unit-test: node_modules
	npm run unit-test

.PHONY: integration-test
integration-test: build
	npm run integration-test

.PHONY: publish
publish: node_modules build
	npm publish

.PHONY: mkdocs
mkdocs:
	python3 -m pip install -r requirements.txt
	python3 -m mkdocs build

.PHONY: publish-docs
publish-docs: mkdocs
	python3 -m mkdocs gh-deploy
