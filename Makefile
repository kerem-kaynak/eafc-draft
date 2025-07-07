.PHONY: help dev-server dev-client deploy

help: ## Show available commands
	@echo "EAFC Draft Commands:"
	@echo ""
	@echo "  dev-server - Start server and database locally"
	@echo "  dev-client - Start React frontend"
	@echo "  deploy     - Deploy to Google Cloud VPS"

dev-server: ## Start server and database locally
	docker compose down
	docker compose up --build

dev-client: ## Start React frontend
	cd client && npm install && npm run dev

deploy: ## Deploy to Google Cloud VPS
	chmod +x deploy.sh && ./deploy.sh 