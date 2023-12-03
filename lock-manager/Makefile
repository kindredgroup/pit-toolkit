

# pp - pretty print function
yellow := $(shell tput setaf 3)
normal := $(shell tput sgr0)
define pp
	@printf '$(yellow)$(1)$(normal)\n'
endef


help: Makefile
	@echo " Choose a command to run:"
	@sed -n 's/^##//p' $< | column -t -s ':' | sed -e 's/^/ /'


# DEV #############################################################################################

## withenv: 😭 CALL TARGETS LIKE THIS `make withenv RECIPE=dev.init`
withenv:
# NB: IT APPEARS THAT LOADING ENVIRONMENT VARIABLES INTO make SUUUUCKS.
# NB: THIS RECIPE IS A HACK TO MAKE IT WORK.
# NB: THAT'S WHY THIS MAKEFILE NEEDS TO BE CALLED LIKE `make withenv RECIPE=dev.init`
	test -e .env || cp .env.example .env
	bash -c 'set -o allexport; source .env; set +o allexport; make "$$RECIPE"'

## dev.init: 🌏 Initialize local dev environment
dev.init:
# Using chimera-dev repo for infrastructure dependencies
#	$(call pp,start docker containers (kafka/postgres/etc)...)
# NB: docker-compose automagically loads environment variables defined in a .env file
#	docker compose --env-file /dev/null up -d
	$(call pp,pull dependencies...)
	npm ci
	$(call pp,install git hooks...)
	npm run husky:prepare
	$(call pp,create development k8s namespace...)
# 	switch to local k8s, just in case
	kubectl config use-context docker-desktop
	kubectl create namespace ${K8S_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
	$(call pp,configure dependent services...)
	deployment/deploy.sh

## dev.clean: 🗑  Cleans all build artefacts (./build, ./dist, ./node_modules)
dev.clean:
	$(call pp,cleaning node_modules)
	rm -rf ./node_modules
	$(call pp,cleaning build)
	rm -rf ./build
	$(call pp,cleaning dist)
	rm -rf ./dist

dev.test:
	$(call pp,running tests...)
	npm run test

dev.migrate.up:
	$(call pp,running migrations...)
	npm run migrate:up

dev.migrate.down:
	$(call pp,running migrations...)
	npm run migrate:down

dev.start:
	$(call pp,starting dev server...)
	npm run build & npm run dev.start

dev.docker.image.build:
	$(call pp,starting dev server...)
	docker build -t ${REGISTRY_URL}/${SERVICE_NAME}:${IMAGE_TAG} .

dev.k8.start:
	$(call pp,starting dev server...)
	sh ./deployment/pit/deploy.sh