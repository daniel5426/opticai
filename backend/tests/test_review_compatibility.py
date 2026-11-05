from services.legacy_exam_compatibility import preserve_unrepresented_components


def test_older_editor_cannot_keep_stale_diopters_or_restore_cleared_reading():
    stored = {'keratometer': {'r_k1': 7.39, 'r_k1_d': 45.61, 'l_k1': 7.8, 'l_k1_d': 43.25}}
    result = preserve_unrepresented_components(stored, {'keratometer': {**stored['keratometer'], 'r_k1': 8.6}})
    assert result['keratometer']['r_k1'] == 8.6
    assert 'r_k1_d' not in result['keratometer']
    assert result['keratometer']['l_k1_d'] == 43.25
    cleared = preserve_unrepresented_components(stored, {'keratometer': {**stored['keratometer'], 'r_k1': ''}})
    assert 'r_k1_d' not in cleared['keratometer']


def test_untouched_imported_units_and_new_editor_pairs_are_preserved():
    stored = {'keratometer': {'r_k1': 7.39, 'r_k1_d': 45.61}}
    assert preserve_unrepresented_components(stored, stored) == stored
    incoming = {'keratometer': {'r_k1': '7.39', 'r_k1_d': 45.61}}
    assert preserve_unrepresented_components(stored, incoming) == incoming
    incoming = {'keratometer': {'r_k1': 8.6, 'r_k1_d': 39.25}}
    assert preserve_unrepresented_components(stored, incoming) == incoming


def test_alembic_revisions_fit_standard_version_column_and_have_one_head():
    import ast
    from pathlib import Path
    revisions = {}
    for path in (Path(__file__).parents[1] / 'alembic/versions').glob('*.py'):
        values = {}
        for node in ast.parse(path.read_text()).body:
            if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                values[node.target.id] = ast.literal_eval(node.value)
            elif isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name) and node.targets[0].id in ('revision', 'down_revision'):
                values[node.targets[0].id] = ast.literal_eval(node.value)
        if 'revision' not in values:
            continue
        revision = values['revision']
        assert len(revision) <= 32, path.name
        assert revision not in revisions
        revisions[revision] = values.get('down_revision')
    parents = {parent for value in revisions.values() for parent in (value if isinstance(value, tuple) else (value,)) if parent is not None}
    assert parents <= revisions.keys()
    assert len(revisions.keys() - parents) == 1
