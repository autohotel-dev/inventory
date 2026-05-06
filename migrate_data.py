import asyncio
import asyncpg
import json
from datetime import date, datetime

SUPABASE_URL = "postgresql://postgres:yfzLU6i4EPOAwJJS@db.plblcxppezsfxwqgbnrn.supabase.co:5432/postgres"
AWS_RDS_URL = "postgresql://adminluxor:Michicondrias_20-10_94%23@luxor-backend-db.ckhca040an8w.us-east-1.rds.amazonaws.com:5432/luxor"

async def migrate():
    print("Connecting to Supabase...")
    src = await asyncpg.connect(SUPABASE_URL)
    print("Connecting to AWS RDS...")
    dst = await asyncpg.connect(AWS_RDS_URL)

    # Disable constraints on destination for this session
    await dst.execute("SET session_replication_role = 'replica';")

    # Get all tables in public schema
    tables = await src.fetch("""
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
    """)

    for record in tables:
        table = record['tablename']
        print(f"\nMigrating table: {table}")
        
        # Get column names
        cols = await src.fetch(f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '{table}'")
        col_names = [c['column_name'] for c in cols]
        
        if not col_names:
            continue

        # Fetch data
        rows = await src.fetch(f"SELECT * FROM \"{table}\"")
        if not rows:
            print(f"Skipping {table} - No data.")
            continue
            
        print(f"Found {len(rows)} rows. Inserting...")
        
        # Prepare insert query
        placeholders = ", ".join(f"${i+1}" for i in range(len(col_names)))
        cols_str = ", ".join(f"\"{c}\"" for c in col_names)
        insert_query = f"INSERT INTO \"{table}\" ({cols_str}) VALUES ({placeholders})"
        
        # Transform data (asyncpg Record to tuple)
        values = []
        for row in rows:
            values.append(tuple(row[c] for c in col_names))
            
        try:
            await dst.executemany(insert_query, values)
            print(f"Successfully migrated {len(rows)} rows to {table}")
        except Exception as e:
            print(f"ERROR on {table}: {e}")

    await dst.execute("SET session_replication_role = 'origin';")
    await src.close()
    await dst.close()
    print("\nMigration complete!")

asyncio.run(migrate())
