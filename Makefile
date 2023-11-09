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
			--set image.tag=$$IMAGE_TAG \
			--set pod.repository=$$REGISTRY_URL/$$SERVICE_NAME \
			--set service.port=$$SERVICE_PORT \
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
			$$TEST_APP_SERVICE_NAME ./$$CHART_PACKAGE; \
		rm $$CHART_PACKAGE; \
		kubectl -n $$K8S_NAMESPACE port-forward service/$$TEST_APP_SERVICE_NAME $$TEST_APP_SERVICE_PORT:http'