"""
MedBridge — One-time drug knowledge seeding script.

Run this ONCE after running migration 002_rag_and_audit.sql and enabling pgvector.

Usage (from backend/ directory with venv active):
    python -m app.seed_drugs

What it does:
  1. Loads indian_drugs_seed.json
  2. Embeds each chunk using sentence-transformers (all-MiniLM-L6-v2)
  3. Upserts into public.drug_knowledge (skips duplicates by drug_name + chunk_type)
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Ensure app module is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import supabase
from app.rag import embed_text


SEED_FILE = Path(__file__).parent / "drug_data" / "indian_drugs_seed.json"


def seed():
    print("MedBridge Drug Knowledge Seeder")
    print("=" * 50)

    if not SEED_FILE.exists():
        print(f"ERROR: Seed file not found at {SEED_FILE}")
        sys.exit(1)

    with open(SEED_FILE) as f:
        entries = json.load(f)

    print(f"Loaded {len(entries)} drug knowledge chunks")
    print("Generating embeddings (sentence-transformers)...")

    # Check for existing entries to avoid duplicates
    existing_res = supabase.table("drug_knowledge").select("drug_name, chunk_type").execute()
    existing = {(r["drug_name"], r["chunk_type"]) for r in (existing_res.data or [])}
    print(f"Found {len(existing)} existing chunks in DB")

    inserted = 0
    skipped = 0
    failed = 0

    for i, entry in enumerate(entries):
        drug_name = entry["drug_name"]
        chunk_type = entry.get("chunk_type", "general")

        # Skip duplicates
        if (drug_name, chunk_type) in existing:
            print(f"  [{i+1:02d}/{len(entries)}] SKIP  {drug_name} ({chunk_type}) — already exists")
            skipped += 1
            continue

        print(f"  [{i+1:02d}/{len(entries)}] EMBED {drug_name} ({chunk_type})...", end=" ", flush=True)

        embedding = embed_text(entry["chunk_text"])
        if embedding is None:
            print("FAILED (embedding error)")
            failed += 1
            continue

        try:
            supabase.table("drug_knowledge").insert({
                "drug_name": drug_name,
                "chunk_text": entry["chunk_text"],
                "chunk_type": chunk_type,
                "embedding": embedding,
                "source": entry.get("source", "curated_open_data"),
            }).execute()
            print("OK")
            inserted += 1
        except Exception as exc:
            print(f"FAILED ({exc})")
            failed += 1

    print()
    print("=" * 50)
    print(f"Done: {inserted} inserted, {skipped} skipped, {failed} failed")

    if inserted > 0:
        print(f"\nRAG pipeline ready — {inserted + skipped} drug knowledge chunks in pgvector")
    elif failed > 0:
        print("\nWARNING: Some chunks failed. Check that pgvector extension is enabled in Supabase.")


if __name__ == "__main__":
    seed()
