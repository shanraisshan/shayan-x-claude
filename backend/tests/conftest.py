import os

# Provide harmless defaults so the app can be imported under test without real Supabase credentials.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
