# Database & Runtime Integrity Guard
- **Automatic DB Seeding Check**: Whenever docker-compose services are recreated, modified, or the database port changes, the agent MUST immediately:
  1. Run Django migrations: `manage.py migrate`.
  2. Setup default roles and permissions: `manage.py setup_roles`.
  3. Ensure a default superuser (e.g., `admin` with password `1017#Emad`) exists.
  4. Prompt or automatically run `seed_db` to populate required metrics, preventing rendering crashes on the dashboard due to empty collections.
- **Frontend Error Boundaries**: Always wrap lazy-loaded components or dashboard metrics with React ErrorBoundaries in `App.jsx` to prevent any chunk error or empty-state API failures from crashing the page into a White Screen of Death (WSOD).
