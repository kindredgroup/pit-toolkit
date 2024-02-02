#!make
SHELL:=/bin/bash

deploy.lock-manager:
	bash -c '\
		cd lock-manager; \
		set -o allexport; source .env; set +o allexport; \
		echo "Deploying $$SERVICE_NAME".; \
		CHART_PACKAGE="$$SERVICE_NAME-0.1.0.tgz"; \
		helm package ./deployment/helm --debug --app-version=$$IMAGE_TAG; \
		helm upgrade --install \
			--atomic \
			--timeout 60s \
			--namespace $$K8S_NAMESPACE \
			--set EXTERNAL_SECRET_DB_PATH=$$EXTERNAL_SECRET_DB_PATH \
			--set IMAGE_TAG=$$IMAGE_TAG \
			--set SERVICE_NAME=$$SERVICE_NAME \
			--set SERVICE_PORT=$$SERVICE_PORT \
			--set PG_MIN_POOL_SIZE=$$PG_MIN_POOL_SIZE \
			--set PGDATABASE=$$PGDATABASE \
			--set PGHOST=$$PGHOST \
			--set PGPORT=$$PGPORT \
			--set PGUSER=$$PGUSER \
			--set PGPASSWORD=$$PGPASSWORD \
			--set pod.repository=$$REGISTRY_URL/$$SERVICE_NAME \
			--set webApp.contextRoot=$$K8S_NAMESPACE.$$WEB_APP_CONTEXT_ROOT"
			$$SERVICE_NAME ./$$CHART_PACKAGE; \
		rm $$CHART_PACKAGE; \
		kubectl -n $$K8S_NAMESPACE port-forward service/$$SERVICE_NAME $$SERVICE_PORT:http'

deploy.node-1:
	bash -c '\
		cd examples/node-1; \
		set -o allexport; source .env; set +o allexport; \
		echo "Deploying $$SERVICE_NAME".; \
		CHART_PACKAGE="$$SERVICE_NAME-0.1.0.tgz"; \
		helm package ./deployment/helm --debug --app-version=$$IMAGE_TAG; \
		helm upgrade --install \
			--atomic \
			--timeout 60s \
			--namespace $$K8S_NAMESPACE \
			--set image.tag=$$IMAGE_TAG \
			--set pod.repository=$$REGISTRY_URL/$$SERVICE_NAME \
			--set service.port=$$SERVICE_PORT \
			$$SERVICE_NAME ./$$CHART_PACKAGE; \
		rm $$CHART_PACKAGE; \
		kubectl -n $$K8S_NAMESPACE port-forward service/$$SERVICE_NAME $$SERVICE_PORT:http'

deploy.node-1-test-app:
	bash -c '\
		cd examples/node-1/pit-test-app; \
		set -o allexport; source ../.env; set +o allexport; \
		echo "Deploying $$TEST_APP_SERVICE_NAME".; \
		CHART_PACKAGE="$$TEST_APP_SERVICE_NAME-0.1.0.tgz"; \
		helm package ./deployment/helm --debug --app-version=$$IMAGE_TAG; \
		helm upgrade --install \
			--atomic \
			--timeout 60s \
			--namespace $$K8S_NAMESPACE \
			--set image.tag=$$IMAGE_TAG \
			--set pod.repository=$$REGISTRY_URL/$$TEST_APP_SERVICE_NAME \
			--set service.port=$$TEST_APP_SERVICE_PORT \
			--set environment.TARGET_SERVICE_URL="http://$$SERVICE_NAME:$$SERVICE_PORT" \
			--set webApp.contextRoot="$$K8S_NAMESPACE.$$TEST_APP_SERVICE_NAME" \
			$$TEST_APP_SERVICE_NAME ./$$CHART_PACKAGE; \
		rm $$CHART_PACKAGE; \
		echo ""; \
		echo "Test app is available on http://localhost:80/$$K8S_NAMESPACE.$$TEST_APP_SERVICE_NAME"'
		#kubectl -n $$K8S_NAMESPACE port-forward service/$$TEST_APP_SERVICE_NAME $$TEST_APP_SERVICE_PORT:http'

deploy.graph-perf-test-app:
	bash -c '\
		cd examples/graph-perf-test-app; \
		cat .env > .env-tmp; echo "" >> .env-tmp; \
		cat ../node-1/.env | sed s/=/_NODE_1=/ | grep -e "^SERVICE_NAME_NODE_1.*" >> .env-tmp; \
		cat ../node-1/.env | sed s/=/_NODE_1=/ | grep -e "^SERVICE_PORT_NODE_1.*" >> .env-tmp; \
		cat .env-tmp; \
		set -o allexport; source .env-tmp; set +o allexport; rm .env-tmp; \
		echo "Deploying $$SERVICE_NAME".; \
		CHART_PACKAGE="$$SERVICE_NAME-0.1.0.tgz"; \
		helm package ./deployment/helm --debug --app-version=$$IMAGE_TAG; \
		helm upgrade --install \
			--timeout 60s \
			--namespace $$K8S_NAMESPACE \
			--set image.tag=$$IMAGE_TAG \
			--set pod.repository=$$REGISTRY_URL/$$SERVICE_NAME \
			--set service.port=$$SERVICE_PORT \
			--set environment.TARGET_SERVICE_URL="http://$$SERVICE_NAME_NODE_1:$$SERVICE_PORT_NODE_1" \
			--set webApp.contextRoot=$$K8S_NAMESPACE.$$SERVICE_NAME \
			$$SERVICE_NAME ./$$CHART_PACKAGE; \
			rm $$CHART_PACKAGE; \
		echo ""; \
		echo "Test app is available on http://localhost:80/$$K8S_NAMESPACE.$$SERVICE_NAME"'
		#kubectl -n $$K8S_NAMESPACE port-forward service/$$SERVICE_NAME $$SERVICE_PORT:http'