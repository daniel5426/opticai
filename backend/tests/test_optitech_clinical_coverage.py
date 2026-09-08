import json
from dataclasses import replace
from backend.migration.optitech.src import records, phase3
from backend.migration.optitech.src.clinical_cards import build_clinical_data, resolve_seed_bases, CARD_TYPES
from backend.migration.optitech.src.exam_layouts import build_instance_layout_data
from backend.migration.optitech.src.repair import merge_imported_data, merge_layout


def test_glasses_missing_values_remain_visible_and_canonical_values_are_bound():
    row = {'PerId': '22747', 'CheckDate': '09/02/26 00:00:00', 'ReCheckDate': '09/02/27 00:00:00',
           'SphR': '-3', 'PrisR': '5', 'BaseR': '3', 'VAR': '34', 'VA': '56', 'PHR': '12',
           'HighR': '7', 'IOPR': '3', 'AddPrisR': '9', 'AddBaseR': '1', 'NPC': '323',
           'FutureClinicalField': 'original', 'PHighR': '6'}
    seed = resolve_seed_bases(records.normalize_glasses_exam_row(row), {'tblBases': {3: 'UP', 1: 'IN'}})
    data = phase3.build_glasses_exam_data(seed, layout_instance_id=7)
    assert data['final-prescription']['r_base'] == 'UP'
    extra = data['optitech-prescription']
    assert extra['PHR'] == '12'
    assert extra['AddPrisR'] == '9'
    assert extra['AddBaseR'] == 'IN'
    assert extra['FutureClinicalField'] == 'original'
    assert extra['PHighR'] == '6'
    assert extra['bindings']['HighR'] == {'component': 'final-prescription', 'field': 'r_high'}
    assert 'HighR' not in extra
    assert data['optitech-examination']['NPC'] == '323'
    assert data['optitech-examination']['ReCheckDate'] == '2027-09-02'
    assert seed.source_ref.raw_payload == row


def test_unknown_source_base_is_not_guessed():
    seed = resolve_seed_bases(records.normalize_glasses_exam_row({'PerId': '1', 'PrisR': '5', 'BaseR': '3'}), {})
    data = phase3.build_glasses_exam_data(seed, layout_instance_id=1)
    assert 'r_base' not in data['final-prescription']
    assert data['optitech-prescription']['unresolved_BaseR'] == '3'


def test_contact_source_units_and_unusual_values_survive():
    seed = records.normalize_contact_lens_exam_row({'PerId': '1', 'rHR': '3.40', 'rVR': '3.30',
        'rHL': '4.40', 'rVL': '5.50', 'BC2R': '3.50', 'PHR': '32', 'OZR': 'wide', 'Ecolor': 'כחול'})
    data = phase3.build_contact_lens_exam_data(seed, layout_instance_id=2, catalog={}, clinic_name='', unresolved_dependencies=[])
    extra = data['optitech-contact-measurements']
    assert extra['rHR'] == '3.40'
    assert extra['rVL'] == '5.50'
    assert extra['BC2R'] == '3.50'
    assert extra['OZR'] == 'wide'
    assert extra['PHR'] == '32'
    assert 'keratometer-contact-lens' not in data


def test_functional_measurements_preserve_strings_zeroes_and_source_grouping():
    data = build_clinical_data('tblCrdDisDiags', {'PerId': '1', 'PushUp': '2', 'MonAccFac6': '0',
        'CoverDist': '5 exo', 'SmVerBO6m': '9/19/10', 'PenLight': '46', 'FutureTest': 'X'}, 9)
    assert data['optitech-accommodation']['MonAccFac6'] == '0'
    assert data['optitech-binocular']['SmVerBO6m'] == '9/19/10'
    assert data['optitech-binocular']['FutureTest'] == 'X'
    layout = json.loads(build_instance_layout_data(CARD_TYPES, data))
    assert len(layout['items']) == 2


def test_questionnaire_labels_legitimate_zeroes_and_default_selections():
    health = build_clinical_data(
        "tblCrdClinicChecks", {"PerId": "1", "CheckDate": "09/02/26", "YN1": "0", "IOPR": "0"}, 3,
        {"tblCrdClinicChars": {1: "Diabetes"}},
    )
    block = health["optitech-examination"]
    assert block["YN1"] == "0"
    assert block["IOPR"] == "0"
    assert block["source_labels"]["YN1"] == "Diabetes"
    assert build_clinical_data(
        "tblCrdGlassChecksGlasses",
        {"PerId": "1", "CheckDate": "09/02/26", "GlassId": "2", "RoleId": "0", "MaterId": "0", "Diam": "0"},
        3, {}, repeated=True,
    ) == {}


def test_repeated_card_identity_is_stable_and_source_key_specific():
    first = build_clinical_data(
        "tblCrdClensFits", {"PerId": "1", "CheckDate": "09/02/26", "FitId": "1", "DiamR": "0", "ComR": "explicit"}, 4,
        {}, repeated=True,
    )
    same = build_clinical_data(
        "tblCrdClensFits", {"PerId": "1", "CheckDate": "09/02/26", "FitId": "1", "DiamR": "0", "ComR": "explicit"}, 4,
        {}, repeated=True,
    )
    other = build_clinical_data(
        "tblCrdClensFits", {"PerId": "1", "CheckDate": "09/02/26", "FitId": "2", "DiamR": "0", "ComR": "explicit"}, 4,
        {}, repeated=True,
    )
    assert next(iter(first)) == next(iter(same))
    assert next(iter(first)) != next(iter(other))
    assert next(iter(first.values()))["DiamR"] == "0"


def test_manifest_clinical_attachment_becomes_file_seed(tmp_path):
    from backend.migration.optitech.src.reader import use_bundle_paths
    tables, documents = tmp_path / "tables", tmp_path / "documents"
    tables.mkdir()
    documents.mkdir()
    stored = documents / "abc-scan.jpg"
    stored.write_bytes(b"image")
    (tmp_path / "manifest.json").write_text(json.dumps({
        "documents": {"references": [{
            "source_table": "tblCrdOverViews", "source_field": "Pic",
            "source_ref": "tblCrdOverViews:row=1", "source_per_id": "7",
            "source_check_date": "09/02/26", "value": "scan.jpg",
            "status": "included", "file": "documents/abc-scan.jpg",
        }]}
    }), encoding="utf-8")
    with use_bundle_paths(tables, documents):
        seeds = list(phase3.iter_file_seeds())
    assert len(seeds) == 1
    assert seeds[0].source_per_id == 7
    assert seeds[0].scan_path == str(stored)
    assert seeds[0].scan_exists is True


def test_three_way_repair_keeps_user_edits_deletions_and_is_repeatable():
    baseline = {'final-prescription': {'r_sph': -3, 'r_base': 'IN', 'l_sph': -4}}
    live = {'final-prescription': {'r_sph': -2, 'r_base': 'IN'}, 'notes': {'note': 'user'}}
    corrected = {'final-prescription': {'r_sph': -3, 'r_base': 'UP', 'l_sph': -4}, 'optitech-prescription': {'PHR': '12'}}
    merged, conflicts = merge_imported_data(baseline, live, corrected)
    assert merged['final-prescription'] == {'r_sph': -2, 'r_base': 'UP'}
    assert merged['notes'] == live['notes']
    assert len(conflicts) == 2
    assert merge_imported_data(corrected, merged, corrected)[0] == merged
    current = json.dumps({'version': 2, 'items': [{'id': 'custom', 'type': 'notes', 'x': 8, 'y': 4, 'w': 6}]})
    new = build_instance_layout_data(CARD_TYPES, corrected)
    layout = merge_layout(current, new)
    assert json.loads(layout)['items'][0]['x'] == 8
    assert merge_layout(layout, new) == layout


def test_previous_refractions_are_not_truncated():
    seed = records.normalize_glasses_exam_row({'PerId': '1'})
    seed = replace(seed, extra_context={'previous_refractions': [{'r_sph': -i} for i in range(1, 9)]})
    data = phase3.build_glasses_exam_data(seed, layout_instance_id=1)
    assert len([k for k in data if k.startswith('old-refraction-')]) == 8


def test_repair_updates_saved_alias_and_preserves_edited_alias_and_repeated_card():
    from backend.migration.optitech.src.repair import include_live_card_aliases
    old = {'final-prescription': {'card_instance_id': 'final-prescription-1', 'r_base': 'IN', 'r_sph': -3}}
    new = {'final-prescription': {**old['final-prescription'], 'r_base': 'UP'}}
    alias = 'final-prescription-final-prescription-1'
    repeat = 'final-prescription-final-prescription-2'
    live = {**old, alias: {**old['final-prescription'], 'r_sph': -2}, repeat: {'r_base': 'OUT'}}
    baseline, corrected = include_live_card_aliases(old, live, new)
    merged, conflicts = merge_imported_data(baseline, live, corrected)
    assert merged[alias]['r_base'] == 'UP'
    assert merged[alias]['r_sph'] == -2
    assert merged[repeat] == live[repeat]
    assert any(x['path'] == alias + '.r_sph' for x in conflicts)


def test_clinical_import_keeps_dates_raw_snapshots_and_source_scope(monkeypatch):
    from backend.tests.test_optitech_phase3 import _build_session, _create_company_and_clinic
    from backend.migration.optitech.src import clinical_import
    from models import OpticalExam, ExamLayoutInstance, MigrationSourceLink
    db = _build_session()
    _, clinic = _create_company_and_clinic(db)
    rows = [
        {'PerId': '1', 'CheckDate': '09/02/26', 'PushUp': '2', 'NearLatPhoria': '98 exo'},
        {'PerId': '1', 'CheckDate': '09/03/26', 'PushUp': '1'},
        {'PerId': '2', 'CheckDate': '09/02/26', 'PushUp': '7'},
        {'PerId': '1', 'CheckDate': '', 'PushUp': '8'},
    ]
    monkeypatch.setattr(clinical_import, 'iter_exported_rows', lambda table: rows if table == 'tblCrdDisDiags' else [])
    kwargs = dict(clinic=clinic, client_map={1: 100}, user_map={}, migration_job_id='job-clinical')
    counts, skips = clinical_import.import_clinical_exams(db, **kwargs)
    db.flush()
    assert counts['created'] == 2
    assert {x['reason'] for x in skips} == {'missing_phase2_client_mapping', 'missing_exam_date'}
    exams = db.query(OpticalExam).order_by(OpticalExam.exam_date).all()
    assert [x.exam_date.isoformat() for x in exams] == ['2026-09-02', '2026-09-03']
    assert all(x.clinic_id == clinic.id and x.client_id == 100 for x in exams)
    instance = db.query(ExamLayoutInstance).filter_by(exam_id=exams[0].id).one()
    assert instance.exam_data['optitech-binocular']['NearLatPhoria'] == '98 exo'
    raw = db.query(MigrationSourceLink).filter_by(target_model='OpticalExam', target_id=exams[0].id).one()
    assert raw.raw_payload == rows[0]
    clinical_import.import_clinical_exams(db, **kwargs)
    assert db.query(OpticalExam).count() == 2
    counts, _ = clinical_import.import_clinical_exams(db, **{**kwargs, 'migration_job_id': 'different-job'})
    assert counts['created'] == counts['updated'] == 0
    db.close()


def test_child_specifications_attach_by_exact_source_parent_and_retry_is_stable(monkeypatch):
    from backend.tests.test_optitech_phase3 import _build_session, _create_company_and_clinic
    from backend.migration.optitech.src import clinical_import
    from backend.migration.optitech.src.records import NormalizedSeedBase, build_source_ref
    from backend.migration.optitech.src.trace import build_trace_payload, upsert_source_link
    from models import OpticalExam, ExamLayoutInstance

    db = _build_session()
    _, clinic = _create_company_and_clinic(db)
    exam = OpticalExam(client_id=100, clinic_id=clinic.id, clinic=clinic.name, exam_date=records.parse_access_date("09/02/26"), test_name="parent", type="exam")
    db.add(exam)
    db.flush()
    instance = ExamLayoutInstance(exam_id=exam.id, is_active=True, order=0, exam_data={}, layout_data=build_instance_layout_data([], {}))
    db.add(instance)
    db.flush()
    parent_row = {"PerId": "1", "CheckDate": "09/02/26"}
    parent_ref = build_source_ref("tblCrdGlassChecks", parent_row)
    parent_seed = NormalizedSeedBase(source_ref=parent_ref, source_per_id=1, source_user_id=None)
    upsert_source_link(db, source_ref=parent_ref, source_per_id=1, source_user_id=None,
        target_model="ExamLayoutInstance", target_id=instance.id, clinic_id=clinic.id,
        company_id=clinic.company_id, payload=build_trace_payload(parent_seed, {}, {}), migration_job_id="job-child")
    db.flush()
    rows = [{"PerId": "1", "CheckDate": "09/02/26", "GlassId": "8", "RoleId": "7", "Diam": "70"}]
    monkeypatch.setattr(clinical_import, "iter_exported_rows", lambda table: rows if table == "tblCrdGlassChecksGlasses" else [])
    kwargs = dict(clinic=clinic, client_map={1: 100}, user_map={}, migration_job_id="job-child", catalog={"tblCrdGlassRole": {7: "Distance"}})
    counts, _ = clinical_import.import_clinical_exams(db, **kwargs)
    db.flush()
    assert counts["attached"] == 1
    assert db.query(OpticalExam).count() == 1
    db.refresh(instance)
    cards = [value for key, value in instance.exam_data.items() if key.startswith("optitech-prescription")]
    assert cards[0]["RoleId"] == "Distance"
    first_keys = set(instance.exam_data)
    clinical_import.import_clinical_exams(db, **kwargs)
    db.refresh(instance)
    assert set(instance.exam_data) == first_keys
    db.close()


def test_child_with_only_similar_parent_date_is_preserved_as_standalone(monkeypatch):
    from backend.tests.test_optitech_phase3 import _build_session, _create_company_and_clinic
    from backend.migration.optitech.src import clinical_import
    from backend.migration.optitech.src.records import NormalizedSeedBase, build_source_ref
    from backend.migration.optitech.src.trace import build_trace_payload, upsert_source_link
    from models import OpticalExam, ExamLayoutInstance
    db = _build_session()
    _, clinic = _create_company_and_clinic(db)
    exam = OpticalExam(client_id=100, clinic_id=clinic.id, clinic=clinic.name, exam_date=records.parse_access_date("09/02/26"), test_name="parent", type="exam")
    db.add(exam); db.flush()
    instance = ExamLayoutInstance(exam_id=exam.id, is_active=True, order=0, exam_data={}, layout_data=build_instance_layout_data([], {}))
    db.add(instance); db.flush()
    parent_row = {"PerId": "1", "CheckDate": "09/02/26"}
    ref = build_source_ref("tblCrdGlassChecks", parent_row)
    seed = NormalizedSeedBase(source_ref=ref, source_per_id=1, source_user_id=None)
    upsert_source_link(db, source_ref=ref, source_per_id=1, source_user_id=None, target_model="ExamLayoutInstance",
        target_id=instance.id, clinic_id=clinic.id, company_id=clinic.company_id,
        payload=build_trace_payload(seed, {}, {}), migration_job_id="job-missing-parent")
    db.flush()
    child = [{"PerId": "1", "CheckDate": "09/03/26", "GlassId": "9", "RoleId": "7"}]
    monkeypatch.setattr(clinical_import, "iter_exported_rows", lambda table: child if table == "tblCrdGlassChecksGlasses" else [])
    counts, dispositions = clinical_import.import_clinical_exams(
        db, clinic=clinic, client_map={1: 100}, user_map={}, migration_job_id="job-missing-parent",
        catalog={"tblCrdGlassRole": {7: "Distance"}},
    )
    assert counts["unresolved_parent"] == 1
    assert db.query(OpticalExam).count() == 2
    assert any(item["reason"] == "missing_parent_preserved_standalone" for item in dispositions)
    db.close()


def test_previous_slots_keep_exact_suffix_and_unslotted_source_fields(monkeypatch):
    monkeypatch.setattr(phase3, 'load_lookup_catalog', lambda: {})
    main = {'PerId': '1', 'CheckDate': '09/02/26'}
    previous = {**main, 'PrevId': '8', 'SphR1': '-1', 'SphR11': '-11', 'ExtPrisR11': '4', 'CustomNote': 'keep'}
    monkeypatch.setattr(phase3, 'iter_exported_rows', lambda table: [previous] if table == 'tblCrdGlassChecksPrevs' else [main])
    seed = next(phase3.iter_glasses_exam_seeds())
    tabs = seed.extra_context['previous_refractions']
    assert tabs[0]['source_fields'] == {'SphR1': '-1'}
    assert tabs[1]['source_fields'] == {'SphR11': '-11', 'ExtPrisR11': '4'}
    assert seed.extra_context['previous_raw_rows'] == [previous]
    data = phase3.build_glasses_exam_data(seed, layout_instance_id=1)
    assert data['optitech-prescription-optitech-prescription-previous-row-1']['CustomNote'] == 'keep'


def test_unresolved_contact_catalog_codes_are_visible():
    seed = records.normalize_contact_lens_exam_row({'PerId': '1', 'ClensBrandIdR': '99', 'MaterR': '8'})
    data = phase3.build_contact_lens_exam_data(seed, layout_instance_id=1, catalog={}, clinic_name='', unresolved_dependencies=[])
    assert data['optitech-contact-measurements']['ClensBrandIdR'] == '99'
    assert data['optitech-contact-measurements']['MaterR'] == '8'


def test_repair_does_not_restore_a_card_removed_after_import():
    old = json.dumps({'items': [{'id': 'removed', 'type': 'optitech-examination', 'x': 0, 'y': 0}]})
    current = json.dumps({'items': []})
    assert json.loads(merge_layout(current, old, old))['items'] == []
