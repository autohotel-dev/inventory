import asyncio
import asyncpg

SUPABASE_URL = "postgresql://postgres:yfzLU6i4EPOAwJJS@db.plblcxppezsfxwqgbnrn.supabase.co:5432/postgres"
AWS_RDS_URL = "postgresql://adminluxor:Michicondrias_20-10_94%23@luxor-backend-db.ckhca040an8w.us-east-1.rds.amazonaws.com:5432/luxor"

async def migrate_table(src, dst, table):
    print(f"\nMigrating table: {table}")
    
    # Get column names EXCEPT generated columns
    cols = await src.fetch(f"""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = '{table}'
        AND is_generated = 'NEVER'
    """)
    col_names = [c['column_name'] for c in cols]
    
    rows = await src.fetch(f"SELECT {', '.join(f'\"{c}\"' for c in col_names)} FROM \"{table}\"")
    if not rows:
        return
        
    print(f"Found {len(rows)} rows. Inserting...")
    
    placeholders = ", ".join(f"${i+1}" for i in range(len(col_names)))
    cols_str = ", ".join(f"\"{c}\"" for c in col_names)
    insert_query = f"INSERT INTO \"{table}\" ({cols_str}) VALUES ({placeholders})"
    
    values = [tuple(row[c] for c in col_names) for row in rows]
        
    try:
        await dst.executemany(insert_query, values)
        print(f"Successfully migrated {len(rows)} rows to {table}")
    except Exception as e:
        print(f"ERROR on {table}: {e}")

async def migrate():
    src = await asyncpg.connect(SUPABASE_URL)
    dst = await asyncpg.connect(AWS_RDS_URL)
    await dst.execute("SET session_replication_role = 'replica';")

    await migrate_table(src, dst, 'purchase_order_items')
    await migrate_table(src, dst, 'sales_order_items')

    await dst.execute("SET session_replication_role = 'origin';")
    await src.close()
    await dst.close()
    print("\nItems Migration complete!")

asyncio.run(migrate())
