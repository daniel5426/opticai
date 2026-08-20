from services.prism_axis_compatibility import (
    normalize_prism_axis_block,
    normalize_prism_axis_exam_data,
)


def test_dual_writes_horizontal_aliases_from_legacy_keys():
    normalized = normalize_prism_axis_block({"r_pris": 2, "r_base": "IN", "l_sph": -1})
    assert normalized["r_pr_h"] == 2
    assert normalized["r_base_h"] == "IN"
    assert normalized["r_pris"] == 2
    assert normalized["r_base"] == "IN"


def test_fills_legacy_keys_from_split_only_values():
    normalized = normalize_prism_axis_block({"r_pr_h": 1.5, "r_base_h": "OUT"})
    assert normalized["r_pris"] == 1.5
    assert normalized["r_base"] == "OUT"


def test_prefers_legacy_when_old_client_leaves_stale_split_alias():
    normalized = normalize_prism_axis_block({"r_pris": 4, "r_pr_h": 2})
    assert normalized["r_pris"] == 4
    assert normalized["r_pr_h"] == 4


def test_normalizes_instance_keyed_subjective_and_final_blocks():
    normalized = normalize_prism_axis_exam_data(
        {
            "subjective-card-1": {"r_pris": 3, "r_base": "UP"},
            "final-subjective": {"l_pris": 1, "l_base": "OUT"},
            "notes": {"text": "keep"},
        }
    )
    assert normalized["subjective-card-1"]["r_pr_h"] == 3
    assert normalized["final-subjective"]["l_pr_h"] == 1
    assert normalized["notes"] == {"text": "keep"}
