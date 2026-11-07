"""Synthetic save benchmark. Uses only disposable in-memory SQLite databases.

Optional --baseline-order-service reads a pre-change service source file; it never
checks out a repository or connects to a configured clinic database.
"""
import argparse
import ast
import asyncio
import json
import os
from pathlib import Path
import statistics
import sys
import time
from types import SimpleNamespace

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "isolated-save-benchmark-only"
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from database import Base
from models import Company, Clinic, User, Client, ExamLayout, ExamLayoutInstance, OpticalExam
from schemas import ExamWorkspaceSave, OpticalExamCreate
from services.exam_workspace import save_workspace, save_token
from services import order_group_service
from EndPoints import exams, unified_exam_data


def source_functions(source, namespace, names):
    tree = ast.parse(source)
    selected = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
    for node in selected:
        node.decorator_list = []
    result = dict(namespace)
    exec(compile(ast.Module(body=selected, type_ignores=[]), "<benchmark-baseline>", "exec"), result)
    return result


def context():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False)()
    company = Company(name="Synthetic", owner_full_name="Synthetic")
    db.add(company); db.flush()
    clinic = Clinic(company_id=company.id, name="Synthetic", unique_id="benchmark")
    db.add(clinic); db.flush()
    user = User(company_id=company.id, clinic_id=clinic.id, role_level=2, username="benchmark")
    client = Client(company_id=company.id, clinic_id=clinic.id, first_name="Synthetic")
    layout = ExamLayout(clinic_id=clinic.id, name="Synthetic", layout_data="[]", is_active=True)
    db.add_all([user, client, layout]); db.commit()
    counts = {"sql": 0, "commits": 0}
    event.listen(engine, "before_cursor_execute", lambda *_: counts.__setitem__("sql", counts["sql"] + 1))
    event.listen(db, "after_commit", lambda *_: counts.__setitem__("commits", counts["commits"] + 1))
    return engine, db, user, clinic, client, layout, counts


def measure(operation, counts, samples):
    times, queries, commits = [], [], []
    for index in range(samples):
        counts.update(sql=0, commits=0)
        start = time.perf_counter()
        operation(index)
        times.append((time.perf_counter() - start) * 1000)
        queries.append(counts["sql"]); commits.append(counts["commits"])
    return {"p50_ms": round(statistics.median(times), 1),
            "p95_ms": round(sorted(times)[max(0, int(len(times) * .95 + .999) - 1)], 1),
            "sql_median": statistics.median(queries), "commits_median": statistics.median(commits)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=10)
    parser.add_argument("--rtt-ms", type=float, default=150)
    parser.add_argument("--baseline-order-service", type=Path)
    parser.add_argument("--baseline-exams", type=Path)
    args = parser.parse_args()
    assert 1 <= args.samples <= 100 and 0 <= args.rtt_ms <= 1000
    pause = lambda: time.sleep(args.rtt_ms / 1000)
    request = SimpleNamespace(headers={"X-Prysm-Exam-Write": "replace-v1", "X-Prysm-Exam-Components": "notes"})
    results = {"database": "disposable SQLite", "rtt_ms": args.rtt_ms, "samples": args.samples, "cases": []}
    update_exam = exams.update_exam
    if args.baseline_exams:
        update_exam = source_functions(args.baseline_exams.read_text(), vars(exams), {"update_exam"})["update_exam"]
    before_order = None
    if args.baseline_order_service:
        before_order = source_functions(args.baseline_order_service.read_text(), vars(order_group_service), {"save_group", "group_dict"})["save_group"]
    for count in (1, 4, 10):
        engine, db, user, clinic, client, layout, counters = context()
        initial = save_workspace(db, user, ExamWorkspaceSave(exam={"client_id": client.id, "clinic_id": clinic.id, "user_id": user.id, "exam_date": "2026-11-07"},
            instances=[{"client_key": str(index), "layout_id": layout.id, "exam_data": {"notes": {"text": "Initial"}}} for index in range(count)]), request, creation_key="benchmark")
        exam_id = initial["exam"]["id"]
        ids = [row["instance"]["id"] for row in initial["instances"]]

        def old(index):
            pause()
            update_exam(exam_id, OpticalExamCreate(client_id=client.id, clinic_id=clinic.id, user_id=user.id, test_name=f"Old {index}"), db, user)
            for instance_id in ids:
                pause()
                async def body(): return {"notes": {"text": f"Old {index}"}}
                asyncio.run(unified_exam_data.save_exam_data(instance_id, SimpleNamespace(json=body, headers=request.headers), db, user))

        token = initial["save_token"]

        def current(index):
            nonlocal token
            pause()
            result = save_workspace(db, user, ExamWorkspaceSave(exam={"test_name": f"New {index}"}, save_token=token,
                instances=[{"id": ids[0], "client_key": str(ids[0]), "exam_data": {"notes": {"text": f"New {index}"}}}]), request, exam_id=exam_id)
            token = result["save_token"]

        before = measure(old, counters, args.samples)
        token = save_token(db.get(OpticalExam, exam_id), db.query(ExamLayoutInstance).filter_by(exam_id=exam_id).all())
        after = measure(current, counters, args.samples)
        results["cases"].append({"kind": "exam", "layouts": count, "before_requests": 1 + count, "after_requests": 1, "before": before, "after": after})
        db.close(); engine.dispose()

    for count in (1, 5):
        engine, db, user, clinic, client, layout, counters = context()
        payload = {"clinic_id": clinic.id, "payer_client_id": client.id,
                   "entries": [{"client_key": str(index), "kind": "regular", "order": {"client_id": client.id, "type": "Distance", "order_date": "2026-11-07"}} for index in range(count)]}
        group = order_group_service.save_group(db, user, payload, creation_key="benchmark")

        def write(service, index):
            nonlocal group
            pause()
            entries = [{**entry, "client_key": str(entry["id"])} for entry in group["entries"]]
            entries[0] = {**entries[0], "order": {**entries[0]["order"], "notes": f"Note {index}"}}
            group = service(db, user, {"revision": group["revision"], "entries": entries}, group_id=group["id"])

        before = measure(lambda index: write(before_order, index), counters, args.samples) if before_order else None
        after = measure(lambda index: write(order_group_service.save_group, index + args.samples), counters, args.samples)
        results["cases"].append({"kind": "order", "entries": count, "before_requests": 1, "after_requests": 1,
                                  "before": before, "after": after, "note": "Server acknowledgement only; removed frontend reloads are checked separately."})
        db.close(); engine.dispose()
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
